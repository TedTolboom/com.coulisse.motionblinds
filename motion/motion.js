// Support for Motionblinds by Coulisse, by Edwin Delsman

const Crypto = require('crypto');
const UDP = require('dgram');
const EventEmitter = require('events');

const MULTICAST_ADDRESS = '238.0.0.18';
const UDP_PORT_SEND     = 32100;
const UDP_PORT_RECEIVE  = 32101;

class MotionGateway {
    constructor(mdriver, mac) {
        this.motionDriver = mdriver;
        this.mac = mac;
        this.gatewayAddress = null;
        this.accessToken = null;
        this.token = null;
        this.nrDevices = 0;
        this.key = mdriver.key;
    }

    calculateAccessToken() {
        try {
            if (this.key != null && this.token != null) {
                if (this.motionDriver.verbose)
                    this.motionDriver.log('Key = "' + this.key + '", Token = "' + this.token + '"');
                const cipher = Crypto.createCipheriv('aes-128-ecb', this.key, null);
                let buff = Buffer.concat([cipher.update(this.token), cipher.final()]);
                let text = buff.toString('hex');
                let wasnotready = this.accessToken == null;
                this.accessToken = text.substring(0, 32).toUpperCase();
                this.motionDriver.log('Accesstoken set'+ (this.motionDriver.verbose ? ' to "' + this.accessToken + '"' : ''));
                if (wasnotready) 
                    this.motionDriver.onReady(this.mac);
            } else if (this.accessToken != null) {
                this.accessToken = null;
                this.motionDriver.log('Accesstoken cleared');
                this.motionDriver.onNotReady(this.mac);
            }
        } catch (err) {
            this.motionDriver.log('Error calculating Access Token for Key = "' + this.key + '", Token = "' + this.token + '"');
            this.motionDriver.log(err);
            this.accessToken = null;
            this.motionDriver.onNotReady(this.mac);
        }
    }

    setToken(newToken) {
        if (newToken == undefined)
            newToken = null;
        if (newToken != null && newToken != this.token) {
            this.token = newToken;
            this.calculateAccessToken();
        }
    }

    setAppKey(appKey) {
        if (appKey == undefined)
            appKey = null;
        if (appKey != this.key) {
            this.key = appKey;
            this.calculateAccessToken();
        }
    }

    setGatewayAddress(addr) {
        if (this.gatewayAddress != addr) {
            this.gatewayAddress = addr;
            return true;
        }
        return false;
    }

    isReady() {
        return this.accessToken != null;
    }
}

class MotionDeviceID {
    constructor(mac, deviceType) {
        this.mac = mac;
        this.deviceType = deviceType;
        this.registered = false;
    }
}

class MotionDevice {
    constructor(mac, deviceType, gateway) {
        this.id = new MotionDeviceID(mac, deviceType);
        this.gateway = gateway;
    }
}

/*
This driver provides access to the Motionblinds Wi-Fi Gateways that are in your local network.
Use the connect method to open communication with the gateways. The key provided can be retrieved from the Motionblinds app: 
Quickly tap the 'Motion APP about' 5 times to get the key, it should have format of the following example: 74ae544c-d16e-4c

You can listen to the following events (though there should not be any imminent need):

'listening' The UDP socket is now listening
'senderror' An error occurred during send
'close' Cle UPD socket was closed
'connect' The Motion Gateway is being connected
'disconnect' The Motion Gateway is being disconnected
'ready' The accesstoken is calculated for the gateway with the given mac, so you can write to its devices and/or get device states.
'notReady' The accesstoken for the gateway with the given mac is no longer available (e.g. due to close or key reset)
'newDevice' the device with the given mac is added
'newDevices' One or more new device were detected

Furthermote you can listen to all the msgTypes that the gateway supports. 
This is the preferred way of interacting with the MotionGateway.
Refer to their API documentation for all the messages.

This class provides the required accessToken (once ready) and messageID() to create the requests.
Also, the gateway retreives the deviceList, so you can make use of it
The deviceList should be there when the ready state is set, but in theory the heartbeat can come first, 
so it is wise to listen for the incoming 'GetDeviceListAck' message instead.
*/
class MotionDriver extends EventEmitter {
    DeviceType = {
        Gateway: '02000001', 
        ChildGateway: '02000002', 
        Blind: '10000000', 
        TopDownBottomUp: '10000001', 
        DoubleRoller: '10000002'
    }
    
    BlindType = { // Blind type matching of the blind using the values provided by the MotionDriver
        RollerBlind: 1,
        VenetianBlind: 2,
        RomanBlind: 3,
        HoneycombBlind: 4,
        ShangriLaBlind: 5,
        RollerShutter: 6,
        RollerGate: 7,
        Awning: 8,
        TopDownBottomUp: 9,
        DayNightBlind: 10,
        DimmingBlind: 11,
        Curtain: 12,
        CurtainLeft: 13,
        CurtainRight: 14,
        DoubleRoller: 17,
        Switch: 43
    }
    
    Operation = { 
        Close_Down: 0,
        Open_Up: 1,
        Stop: 2,
        StatusQuery: 5
    }

    Position = { 
        Open_Up: 0,
        Close_Down: 100
    }

    Angle = { 
        Open: 0,
        DR_Close: 90,
        Close: 180
    }

    LimitStatus = { 
        NoLimits: 0,
        TopLimit: 1,
        BottomLimit: 2,
        Limits: 3,
        Limit3: 4
    }
    
    VoltageMode = { 
        AC: 0,
        DC: 1
    }
    
    WirelessMode = { 
        UniDirection: 0,
        BiDirection: 1,
        BidirectionMech: 2,
        Others: 3
    }
    
    constructor(motionapp = null, timezone = null) { 
        super();
        this.app = motionapp; // using external reference somehow works better than Homey.app, which is undefined when this initialises?
        this.timezone = timezone;
        this.key = null;
        this.devices = new Map();
        this.logging = true;
        this.verbose = false;
        this.logHeartbeat = false;
        this.pollAgain = false;
        this.pollTimer = undefined;
        this.multicast = false;
        this.multisocket = false;
        this.ip = undefined;
        this.listening = false;
        this.setMaxListeners(50);
        this.client = null;
        this.server = null;
        this.lastMessageID = null;
        process.on('SIGTERM', function() { this.disconnect() }.bind(this));
    }

	log(msg) {
        if (this.logging)
            if (this.app != null && this.app != undefined)
                this.app.log(msg);
            else
                console.log(msg);
    }

    error(msg) {
        if (this.app != null && this.app != undefined)
            this.app.error(msg);
        else
            console.error(msg);
    }

    settimezone(timezone) {
        this.log('Timezone changed to ' + timezone);
        this.timezone = timezone;
    }

    checkMessageID(message) {
        try {
            if (message != null && message != undefined && message.msgID != null && message.msgID != undefined) {
                let id = BigInt(message.msgID);
                if (id > this.lastMessageID) {
                    if (this.verbose)
                        this.log('incremented messageID from ' + this.lastMessageID + ' to ' + id);
                    this.lastMessageID = id;
                    }
            }
        } catch (error) {
            this.log(error);
        }
    }

    getMessageID() {
        let id = new Date().toISOString().replace(/[T\-\./:Z]/g, '');
        if (this.timezone != null && this.timezone != undefined) 
            try { // homey has UTC clock and no proper means to get right timezone :-(
                let nowid = new Date().toLocaleString('sv', { timeZone: this.timezone} ).replace(/[T\- \./:Z]/g, '');
                if (nowid.length < id.length)
                    nowid = nowid + id.substring(nowid.length);
                if (/^\d+$/.test(nowid))
                    id = nowid;
            } catch (error) { // if this does not provide a suitable answer, proceed with old implementation
                this.log(error);
            }
        try {
            let msgid = BigInt(id);
            if (this.lastMessageID != null && this.lastMessageID != undefined && this.lastMessageID >= msgid) {
                msgid = this.lastMessageID + BigInt(1);
                id = msgid.toString();
                if (this.verbose)
                if (this.verbose)
                    this.log('incremented messageID from ' + this.lastMessageID + ' to ' + id);
            }
            this.lastMessageID = msgid;
            } catch (error) {
            this.log(error);
        }
        return id;
    }

    setIP(ip) {
        this.ip = ip == null || ip == '' ? undefined : ip;
        if (this.listening) 
            this.send({ "msgType": "GetDeviceList", "msgID": this.getMessageID() });
    }

    setAppKey(appKey) {
        if (appKey == undefined)
            appKey = null;
        if (appKey != this.key) {
            this.key = appKey;
            for (let entry of this.devices.values()) 
                entry.gateway.setAppKey(appKey);
        }
    }

    getAccessToken(mac, deviceType) {
        let gateway = this.getGateway(mac, deviceType);
        if (gateway != undefined && gateway.isReady())
            return gateway.accessToken;
        for (let entry of this.devices.values())  // fallback: hope / assume all gateways share the same token, best guess is better than none
            if (entry.gateway.isReady()) 
                return entry.gateway.accessToken;        
        return undefined;
    }

    percentageClosedToPosition(perc) {
        if (perc == undefined)
            return undefined;
        let pos = Math.round(perc * this.Position.Close_Down);
        return Math.max(Math.min(pos, this.Position.Close_Down), this.Position.Open_Up);
    }

    percentageOpenToPosition(perc) {
        return perc == undefined ? undefined : this.Position.Close_Down - this.percentageClosedToPosition(perc);
    }

    positionToPercentageClosed(pos) {
        if (pos == undefined)
            return undefined;
        let perc = Math.round(pos) / this.Position.Close_Down;
        return Math.min(Math.max(perc, 0), 1);
    }

    positionToPercentageOpen(pos) {
        return pos == undefined ? undefined : 1 - this.positionToPercentageClosed(pos);
    }
    
    angleToPercentageTilt(angle, max_tilt = this.Angle.Close) {
        if (angle == undefined)
            return undefined;
        let perc = Math.round(angle) / max_tilt;
        return 1 - Math.min(Math.max(perc, 0), 1);
    }

    percentageTiltToAngle(perc, max_tilt = this.Angle.Close) {
        if (perc == undefined)
            return undefined;
        let angle = Math.round(perc * max_tilt);
        return max_tilt - Math.max(Math.min(angle, max_tilt), this.Angle.Open);
    }

    batteryLevelToPercentage(level) {
        if (level == undefined)
            return undefined;
        let voltage = level / 100;
        let cells = Math.round(voltage / 3.7); // estimate nr of cells, min is 3.2 and max is 4.2 per cell, will work ok for about 2 to 4 cells
        let min = 3.35 * cells;  // minimum voltage, actual empty is 3.2, but below 3.3 to 3.4 average cells usually drop very rapidly, so assume empty early rather than late. 
        let max = 4.05 * cells; // maximum voltage when fully charged. Should be 4.2 but Motionblinds seem to be charged less, which prolongs life. Also one expects to charge to full.
        let perc = Math.round((voltage - min) * 100 / (max - min), 0); // this assumes linear, which isn't true but will do until around 3.4 volt per cell, and average is now 3.7 which is usually true for most cells.
        return Math.min(100, Math.max(perc, 0));
    }

    /** use mac to find getGateway by it's mac, or add one if the deviceType is for a gateway and it isn't found yet.
     * If mac is null or undefined, it returns undefined, otherwise it returns a MotionGateway (either new or existing)
     */
     getGateway(mac, deviceType) { 
        if (mac == undefined || mac == null)
            return undefined;
        let item = this.devices.get(mac);
        if ((deviceType == this.DeviceType.Gateway || deviceType == this.DeviceType.ChildGateway) && item == undefined) {
            item = new MotionDevice(mac, deviceType, new MotionGateway(this, mac));
            this.devices.set(mac, item);
        }
        if (item != undefined) 
            return item.gateway;
        return undefined;
    }

    registerDeviceType(msg) { 
        if (msg.mac != undefined && msg.mac != null && msg.data != undefined && msg.data != null && msg.data.type != undefined) {
            let item = this.devices.get(msg.mac);
            if (item != undefined && item.id.type != msg.data.type) {
                this.log('Registered type ' + msg.data.type + ' for ' + msg.mac);
                item.id.type = msg.data.type;
                if (msg.data.wirelessMode != undefined)
                    item.id.wirelessMode = msg.data.wirelessMode;
            }
        }
    }

    registerDevice(mac, register = true) { 
        let item = this.devices.get(mac);
        if (item != undefined && item.id.registered != register) {
            this.log((register ? 'Registered ' : 'Unregistered ') + mac);
            item.id.registered = register;
            return true;
        } 
        return false;
    }

    setDeviceInGroup(mac, group = true) { 
        let item = this.devices.get(mac);
        if (item != undefined && (item.id.inGroup == true) != group) {
            this.log((mac + (group ? ' put in group' : ' removed from group')));
            item.id.inGroup = group;
            return true;
        } 
        return false;
    }

    isRegisteredDevice(mac) { 
        let item = this.devices.get(mac);
        if (item != undefined)
            return item.id.registered;
        return false;
    }

    getDevices(type = undefined, filter = undefined) {
        let devices = [];
        for (let entry of this.devices.values()) 
            if ((type == entry.id.deviceType || type != undefined && type != null && type.includes(entry.id.deviceType) ||
                ((type == undefined || type == null) && 
                    entry.id.deviceType != this.DeviceType.Gateway && entry.id.deviceType != this.DeviceType.ChildGateway)) &&
                    (filter == undefined || filter(entry.id)))
                devices.push(entry.id);
        return devices;
    }

    onListening() {
            let address = this.client.address();
            this.log('Listening using ' + address.family + ' on ' + address.address + ":" + address.port + ' ' + (this.key == null ? ' without' : 'with') + ' key');
            this.client.setBroadcast(true);
            this.client.setMulticastTTL(128);
            try { // log ENODEV error (seen it happen once) and other. Can do without multicast in a lot of cases, so log and continue
                this.client.addMembership(MULTICAST_ADDRESS);
            } catch (error) {
                this.error(error);
            } 
            this.listening = true;
            this.emit('listening');
            this.send({ "msgType": "GetDeviceList", "msgID": this.getMessageID() });
    }

    onError(error) {
        this.error(error);
        this.emit('onError', error);
    }

    onReady(mac) {
        this.emit('ready', mac);
    }

    onNotReady(mac) {
        this.emit('notReady', mac);
    }

    onMessage(msg, info) {
        try {
            let message = JSON.parse(msg.toString());
            if (message == null || message == undefined) {
                this.error("Received message that parsed to nothing:");
                this.error(msg);
            } else {
                if (this.logHeartbeat || message.msgType != 'Heartbeat') {
                    this.log('Received ' + message.msgType + ' from ' + info.address + ' for ' + message.mac + '-' + message.deviceType);
                    if (this.verbose) 
                        this.log(message);
                } 
                if (message.actionResult != undefined && message.actionResult != null && !this.verbose)
                    this.log(message.actionResult);
                let gateway = this.getGateway(message.mac, message.deviceType);
                gateway.setToken(message.token); 
                this.getGatewayAddress(message, info, gateway);
                this.checkMessageID(message);
                if (message.msgType == 'Heartbeat')
                    this.onHeartbeat(message, info, gateway);
                else if (message.msgType == 'GetDeviceListAck')
                    this.onGetDeviceListAck(message, info, gateway);
                this.registerDeviceType(message);
                this.emit(message.msgType, message, info);
                if (message.actionResult != undefined && message.actionResult != null && 
                    message.msgType == 'WriteDeviceAck'  &&  (msg.data == undefined || msg.data == null)) // write failed
                    this.readDevice(message.mac, message.deviceType);
        }
        } catch (error) {
            this.error(error);
        }
    }

    getGatewayAddress(message, info, gateway) {
        if (!this.multicast && message.mac != undefined && info != null && info != undefined && info.address != undefined &&
            info.address != null && info.address != '0.0.0.0' && info.address != MULTICAST_ADDRESS) {
            if (gateway != undefined && gateway.setGatewayAddress(info.address)) 
                this.log('Gateway adress for mac ' + message.mac + ' set to ' + info.address);
        }
    }

    onClose() {
        this.listening = false;
        this.emit('close');
    }

    onGetDeviceListAck(msg, info, gateway) {
        let added = false;
        if (msg.data != undefined) {
            gateway.nrDevices = msg.data.length - 1; // the first is the gateway itself, so count one less. Remember, so on heartbeat we can see devices added
            if (this.getMaxListeners() < gateway.nrDevices)
                this.setMaxListeners(gateway.nrDevices);
            for (let device of msg.data) 
                if (this.devices.get(device.mac) == undefined) {
                    this.devices.set(device.mac, new MotionDevice(device.mac, device.deviceType, gateway));
                    added = true;
                    this.emit('newDevice', device.mac);
                }
        }
        if (added)
            this.emit('newDevices');
    }
    
    onHeartbeat(msg, info, gateway) {
        if (msg.data != undefined && gateway.nrDevices != msg.data.numberOfDevices) { // if device count changed, get new list
            this.log('Heartbeat found ' + (msg.data.numberOfDevices - gateway.nrDevices) + ' new devices');
            if (this.verbose && !this.logHeartbeat)
                this.log(msg); // do log heartbeat if device count unexpected
            this.send({ "msgType": "GetDeviceList", "msgID": this.getMessageID() }, info == null ? null : info.address);
        }
    }

    async connect() {
        if (this.multisocket) {
            this.server = UDP.createSocket({ type: 'udp4', reuseAddr: true });
            this.server.on('error', function(error) { this.onError(error) }.bind(this));
            this.server.on('message', function(msg, info) { this.onMessage(msg, info) }.bind(this));
            this.server.on('close', function() { this.onClose() }.bind(this));
            // this.server.bind(UDP_PORT_RECEIVE, "192.168.2.50", function() {
            //     this.emit('connectServer');
            // }.bind(this));
            }
        this.client = UDP.createSocket({ type: 'udp4', reuseAddr: true });
        this.client.on('listening', function() { this.onListening() }.bind(this));
        this.client.on('error', function(error) { this.onError(error) }.bind(this));
        this.client.on('message', function(msg, info) { this.onMessage(msg, info) }.bind(this));
        this.client.on('close', function() { this.onClose() }.bind(this));

        this.client.bind(UDP_PORT_RECEIVE, this.multisocket ? MULTICAST_ADDRESS : undefined, function() {
            this.emit('connect');
        }.bind(this));
    }

    async disconnect() {
        if (this.server != null) {
            this.server.close(function () {
                this.server = null;
                this.token = null;
                this.accessToken = null;
                this.deviceList = null;
                this.gatewayAddress = null;
                this.emit('disconnect');
            }.bind(this));
        }
        if (this.client != null) {
            this.client.close(function () {
                this.client = null;
                this.token = null;
                this.accessToken = null;
                this.deviceList = null;
                this.gatewayAddress = null;
                this.emit('disconnect');
            }.bind(this));
        }
    }

    /**
     * Returns true if device write/status commands can be sent. It is required to set the appKey in advance. 
     * Also, the token must be received from the gateway. Untill then only devicelist and heartbeat are possible.
     * @returns boolean if accesstoken is ready
     */
    isReady(mac) {
        let gateway = this.getGateway(mac, this.DeviceType.Gateway);
        return gateway != undefined && gateway.isReady();
    }

    /**
     * Poll all states of all devices. Subsequent calls within the minute will be postponed until the minute is over.
     * if the wirelessMode of the device is known to be bidirectional then ReadDevice is used, 
     * otherwise WriteDevice with operation StatusQuery is called instead.
     * @param registered: if true only devices that registered themselves are polled, otherwise all. 
     * if false, only unregistered devices are polled. if undefined, all devices are polled. 
     * @param groupOnly: only poll those that are set to be part of a group
     */
    async pollStates(registered = true, groupOnly = false, forceWrite = false) {
        this.log('pollStates ' + (registered == undefined ? 'all' : (registered ? 'registered' : 'unregistered')) 
                    + (groupOnly ? ' groupOnly' : '') + (forceWrite ? ' forceWrite' : ''));
        if (this.pollTimer == undefined) {
            this.pollTimer = this.getPollTimer(registered, groupOnly);
            this.pollAgain = false;
            let pollcount = 0;
            for (let entry of this.devices.values()) 
                if (entry.id.deviceType != this.DeviceType.Gateway && entry.id.deviceType != this.DeviceType.ChildGateway && 
                    (registered == undefined || entry.id.registered == registered) &&
                    (!groupOnly || entry.id.inGroup == true)) {
                        ++pollcount;
                        if (forceWrite || entry.id.wirelessMode != this.WirelessMode.BiDirection && 
                                          entry.id.wirelessMode != this.WirelessMode.BidirectionMech)
                            this.writeStatusRequest(entry.id.mac, entry.id.deviceType);
                        else
                            this.readDevice(entry.id.mac, entry.id.deviceType);
                    }
            this.log('polled ' + pollcount + ' devices');
        } else {
            this.pollAgain = true;
            this.log('Nested poll postponed');
        }
    }

    getPollTimer(registered, groupOnly) {
        return setTimeout(function () {
            this.log('PollTimer ends, pollAgain = ' + this.pollAgain);
            this.pollTimer = undefined;
            if (this.pollAgain) {
                this.pollAgain = false;
                this.pollStates(registered, groupOnly);
            }
        }.bind(this), 60000);
    }

    writeStatusRequest(mac, deviceType) {
        if (deviceType == this.DeviceType.TopDownBottomUp) {
            this.readDevice(mac, deviceType); // Statusquery does not seem to work for TDBU. However it is preferred as it seems to update batterystatus, wheres read seems not to
            // this.send({  
            //     "msgType": 'WriteDevice',
            //     "mac": mac,
            //     "deviceType": deviceType,
            //     "accessToken": this.getAccessToken(mac, deviceType),
            //     "msgID": this.getMessageID(),
            //     "data": {
            //         "operation_T": this.Operation.StatusQuery,
            //         "operation_B": this.Operation.StatusQuery
            //     }
            // });
        } else
            this.send({
                "msgType": 'WriteDevice',
                "mac": mac,
                "deviceType": deviceType,
                "accessToken": this.getAccessToken(mac, deviceType),
                "msgID": this.getMessageID(),
                "data": {
                    "operation": this.Operation.StatusQuery
                }
            });
    }

    readDevice(mac, deviceType) {
        this.send({
            "msgType": 'ReadDevice',
            "mac": mac,
            "deviceType": deviceType,
            "accessToken": this.getAccessToken(mac, deviceType),
            "msgID": this.getMessageID()
        });
    }

    async send(msg, addr = null) {
        let message = JSON.stringify(msg);
        let gateway = this.getGateway(msg.mac, msg.deviceType);
        if ((addr == null || addr == undefined) && !this.multicast)
            addr = this.ip;
        if (addr == null || addr == undefined || addr == '')
            addr = this.multicast || gateway == undefined || gateway.gatewayAddress == null || gateway.gatewayAddress == undefined 
                        ? MULTICAST_ADDRESS : gateway.gatewayAddress;
        this.log('Sending ' + msg.msgType + ' to ' + addr + ' for ' + msg.mac + '-' + msg.deviceType);
        if (this.verbose)
            this.log(msg);
        let dgram = this.server == null || addr == MULTICAST_ADDRESS ? this.client : this.server;
        dgram.send(message, UDP_PORT_SEND, addr, function (error, bytes) {
            if (error) {
                this.error(error);
                this.emit('sendError', error);
            }
        }.bind(this));
        this.emit(msg.msgType, msg);
    }
}

module.exports = MotionDriver;
