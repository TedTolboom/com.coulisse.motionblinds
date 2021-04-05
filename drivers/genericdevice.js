// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('../motion/motion')

class MotionDeviceGeneric extends Homey.Device {
  async onInit() {
    this.mdriver = this.homey.app.mdriver;
    // this.mdriver.verbose = true;
    let mac = this.getData().mac;
    this.expectReportTimer = undefined;
    this.registerCapabilityListener('windowcoverings_set', this.onCapabilityWindowcoverings_set.bind(this));
    this.registerCapabilityListener('windowcoverings_tilt_set', this.onCapabilityWindowcoverings_tilt_set.bind(this));
    this.registerCapabilityListener('windowcoverings_state', this.onCapabilityWindowcoverings_state.bind(this));
    this.registerCapabilityListener('measure_battery', this.onCapabilityMeasure_battery.bind(this));
    this.registerCapabilityListener('state_mb_part_closed', this.onCapabilitystate_mb_part_closed.bind(this));
    this.mdriver.on('newDevice', function(newmac) { if (mac == newmac) this.onNewDevice(); }.bind(this));
    this.mdriver.on('Report', function(msg, info) { if (mac == msg.mac) this.onReport(msg, info); }.bind(this));
    this.mdriver.on('ReadDeviceAck', function(msg, info) { if (mac == msg.mac) this.onReadDeviceAck(msg, info); }.bind(this));
    this.mdriver.on('WriteDevice', function(msg, info) { if (mac == msg.mac) this.onWriteDevice(msg, info); }.bind(this));
    this.mdriver.on('WriteDeviceAck', function(msg, info) { if (mac == msg.mac) this.onWriteDeviceAck(msg, info); }.bind(this));
    this.log(mac, 'initialized');
    this.onNewDevice();
  }

  onNewDevice() { // the motiondriver now knows me, so register
    if (this.mdriver.registerDevice(this.getData().mac)) { // check if set. onInit calls this too so it may already be done
      let wirelessMode = this.getSetting('wirelessMode');
      if (wirelessMode == this.mdriver.WirelessMode.BiDirection || wirelessMode == this.mdriver.WirelessMode.BidirectionMech) 
          this.readDevice();
        else
          this.statusQuery();
    }
  }

  async onAdded() {
    this.log(this.getData().mac, 'added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log(this.getData().mac, 'changed settings');
  }

  async onRenamed(name) {
    this.log(this.getData().mac, 'renamed to', name);
  }

  async onDeleted() {
    this.log(this.getData().mac, 'deleted');
    this.mdriver.registerDevice(this.getData().mac, false);
  }
   
  async onCapabilityWindowcoverings_set(value, opts) {
    this.log(this.getData().mac, 'onCapabilityWindowcoverings_set', value);
    this.setCapabilityPartClosed(value);
    this.setPercentageOpen(value);
  }

  async onCapabilityWindowcoverings_tilt_set(value, opts) {
    this.log(this.getData().mac, 'onCapabilityWindowcoverings_tilt_set', value);
    this.setPercentageTilt(value);
  }

  async onCapabilitystate_mb_part_closed(value, opts) {
    this.log(this.getData().mac, 'onCapabilitystate_mb_part_closed', value, opts);
  }

  async onCapabilityWindowcoverings_state(value, opts) {
    this.log(this.getData().mac, 'onCapabilityWindowcoverings_state', value);
    switch(value) {
      case 'up': this.openUp();      break;
      case 'down': this.closeDown(); break;
      case 'idle': this.stop();      break;
    }
  }

  async onCapabilityMeasure_battery(value, opts) {
    this.log(this.getData().mac, 'onCapabilityMeasure_battery', value, opts);
    this.setCapabilityValue('measure_battery', value);
  }

  numberChanged(newval, oldval, treshold) {
    if (oldval == undefined || oldval == null)
      return (newval != null && newval != undefined);
    if ((newval == null || newval == undefined))
      return false;
    return Math.abs(oldval - newval) >= treshold;
  }

  setCapabilityPartClosed(perc) {
    if (perc != undefined) {
      let closed = perc <= 0.99;
      if (this.hasCapability('state_mb_part_closed') && this.getCapabilityValue('state_mb_part_closed') != closed) {
        this.log(this.getData().mac, 'setCapabilityPartClosed', closed);
        this.setCapabilityValue('state_mb_part_closed', closed);
      }
    }
  }

  setCapabilityState(state) {
    if (state == 'down')
      this.setCapabilityPartClosed(0);
    if (state != undefined && this.getCapabilityValue('windowcoverings_state') != state) {
      this.log(this.getData().mac, 'setCapabilityState', state);
      this.setCapabilityValue('windowcoverings_state', state);
      return true;
    }
    return false;
  }

  setCapabilityPercentage(perc) {
    this.setCapabilityPartClosed(perc);
    if (this.hasCapability('windowcoverings_set') && this.numberChanged(perc, this.getCapabilityValue('windowcoverings_set'), 0.05)) {
      this.log(this.getData().mac, 'setCapabilityPercentage', perc);
      this.setCapabilityValue('windowcoverings_set', perc);
      return true;
    }
    return false;
  }

  setCapabilityTiltPercentage(angle) {
    if (this.hasCapability('windowcoverings_tilt_set') && this.numberChanged(angle, this.getCapabilityValue('windowcoverings_tilt_set'), 0.05)) {
      this.log(this.getData().mac, 'setCapabilityTiltPercentage', angle);
      this.setCapabilityValue('windowcoverings_tilt_set', angle);
      return true;
    }
    return false;
  }

  setCapabilityBattery(perc) {
    if (this.hasCapability('measure_battery') && this.numberChanged(perc, this.getCapabilityValue('measure_battery'), 0.1)) {
      this.log(this.getData().mac, 'setCapabilityBattery', perc);
      this.setCapabilityValue('measure_battery', perc);
      return true;
    }
    return false;
  }

  setCapabilityRSSI(dBm) {
    if (dBm != undefined && this.numberChanged(dBm, this.getCapabilityValue('measure_mb_rssi'), 0.5)) {
      this.log(this.getData().mac, 'setCapabilityRSSI', dBm);
          if (!this.hasCapability('measure_mb_rssi')) 
            this.addCapability('measure_mb_rssi');
          this.setCapabilityValue('measure_mb_rssi', dBm);
      return true;
    }
    return false;
  }

  travelDirection(newperc, oldperc) {
    if (oldperc == null || oldperc == undefined || newperc == null || newperc == undefined || 
        !this.numberChanged(newperc, oldperc, 0.05))
      return 'idle';
    return newperc > oldperc ? 'up' : 'down';
  }

  scheduleStop() {
    setTimeout(function () {
      this.log(this.getData().mac, 'scheduledStop');
      this.setCapabilityState('idle');
    }.bind(this), 1250);
  }

  setStates(msg) {
    if (msg.data != undefined) {
      let state = undefined;
      let perc = undefined;
      let angle = undefined;
      switch(msg.data.operation) { // beware! no difference between current and action! Do this first, because for write the others aren't there
        case this.mdriver.Operation.Close_Down: state = 'down'; perc = 0; break;
        case this.mdriver.Operation.Open_Up:    state = 'up';   perc = 1; break;
        case this.mdriver.Operation.Stop:       state = 'idle'; break;
      }
      if (msg.data.targetPosition != undefined) { // so if targetposition specified, overrule operation and current position
        perc = this.mdriver.positionToPercentageOpen(msg.data.targetPosition);
        switch (msg.data.targetPosition) {
          case this.mdriver.Position.Up_Open:    state = 'up';   break;
          case this.mdriver.Position.Close_Down: state = 'down'; break;
          default: state = this.travelDirection(perc, this.getCapabilityValue('windowcoverings_set')); break;
        }
      } else if (msg.data.currentPosition != undefined) { // if currentposition received, overrule operation because then this is is not a state operation
        perc = this.mdriver.positionToPercentageOpen(msg.data.currentPosition);
        state = this.travelDirection(perc, this.getCapabilityValue('windowcoverings_set'));
        if (state != 'idle') { // this is a state report, not a state change, yet it is different from what we know, usually from remote. Signal the change, and force stop a little later.
          this.log(this.getData().mac, 'unexpected position change', state);
          this.scheduleStop(); 
        }
      }
      if (msg.data.targetAngle != undefined)
        angle = this.mdriver.angleToPercentageTilt(msg.data.targetAngle);
      else if (msg.data.currentAngle != undefined)
        angle = this.mdriver.angleToPercentageTilt(msg.data.currentAngle);
      this.setCapabilityState(state);
      this.setCapabilityPercentage(perc);
      this.setCapabilityTiltPercentage(angle);
      if (msg.data.batteryLevel != undefined) 
        this.setCapabilityBattery(msg.data.batteryLevel / 10);
      this.setCapabilityRSSI(msg.data.RSSI);
    }
  }

  checkSettings(msg) {
    if (msg.data != undefined) {
      let save = false;
      let newsettings = {};
      let settings = this.getSettings();
      if (settings == undefined)
        settings = { };
      if (msg.data.type != undefined) {
        // if (msg.data.type == this.mdriver.BlindType.VenetianBlind || 
        //     msg.data.type == this.mdriver.BlindType.ShangriLaBlind) {
        //   if (!this.hasCapability('windowcoverings_tilt_set'))
        //     this.addCapability('windowcoverings_tilt_set')
        // } else {
        //   if (this.hasCapability('windowcoverings_tilt_set'))
        //     this.removeCapability('windowcoverings_tilt_set')
        // }
        if (msg.data.type != settings.type) { 
            newsettings.type = msg.data.type; 
          save = true;
        } 
      }
      if (msg.data.voltageMode != undefined) {
        if (msg.data.voltageMode == this.mdriver.VoltageMode.DC) {
          if (!this.hasCapability('measure_battery'))
            this.addCapability('measure_battery');
        } else {
          if (this.hasCapability('measure_battery'))
            this.removeCapability('measure_battery');
        }
        if (msg.data.voltageMode != settings.voltageMode) { 
          newsettings.voltageMode = msg.data.voltageMode; 
          save = true; 
        }
      }
      if (msg.data.wirelessMode != undefined) {
        if (msg.data.wirelessMode == this.mdriver.WirelessMode.BiDirection || 
            msg.data.wirelessMode == this.mdriver.WirelessMode.BidirectionMech) {
          if (!this.hasCapability('state_mb_part_closed')) 
            this.addCapability('state_mb_part_closed');
          if (!this.hasCapability('windowcoverings_set'))
            this.addCapability('windowcoverings_set')
        } else {
          if (this.hasCapability('state_mb_part_closed')) 
            this.removeCapability('state_mb_part_closed');
          if (this.hasCapability('windowcoverings_set'))
            this.removeCapability('windowcoverings_set')
        }
        if (msg.data.type != settings.type) { 
            newsettings.type = msg.data.type; 
          save = true;
        } 
        if (msg.data.wirelessMode != settings.wirelessMode) { 
          newsettings.wirelessMode = msg.data.wirelessMode; 
          save = true; 
        }
      }
      if (save)
        this.setSettings(newsettings);
    }
  }

  async onReport(msg, info) {
    this.log(this.getData().mac, 'onReport');
    this.setStates(msg);
    this.checkSettings(msg);
    if (this.expectReportTimer != undefined) {  // got the report as expected, don't force read state by the timer
      clearTimeout(this.expectReportTimer);
      this.expectReportTimer = undefined;
    } else { // if a report cones in unannounced, it is often due to a remote. Bad news is, if a remote is tied to several blinds, only one reports. So, poll them all
      this.log(this.getData().mac, 'unexpected Report triggered poll');
      this.mdriver.pollStates();
    }
  }

  async onReadDeviceAck(msg, info) {
    this.log(this.getData().mac, 'onReadDeviceAck');
   // this.setStates(msg);
    // this.checkSettings(msg);
  }

  async onWriteDevice(msg, info) {
    this.log(this.getData().mac, 'onWriteDevice');
    this.setStates(msg);
  }

  async onWriteDeviceAck(msg, info) {
    // this.setStates(msg, false);  don't set 'old' state, wait for result of change
    this.log(this.getData().mac, 'onWriteDeviceAck');
    this.checkSettings(msg);
  }

  async readDevice() {
    let data = this.getData();
    this.mdriver.send({
			"msgType": 'ReadDevice',
			"mac": data.mac,
			"deviceType": data.deviceType,
			"accessToken": this.mdriver.getAccessTokenByID(data),
			"msgID": this.mdriver.getMessageID()
		});  
  }

  async writeDevice(newdata) {
    let data = this.getData();
    if (this.expectReportTimer) 
      clearTimeout(this.expectReportTimer); // expect report later if commands follow up quickly
    this.expectReportTimer = setTimeout(function() { // expect a report, if it does not come in a minute, read state by yourself
        this.log(this.getData().mac, 'onReportTimeout');
        this.expectReportTimer = undefined;
        this.readDevice();
      }.bind(this), 60000); 
    this.mdriver.send({
			"msgType": 'WriteDevice',
			"mac": data.mac,
			"deviceType": data.deviceType,
			"accessToken": this.mdriver.getAccessTokenByID(data),
			"msgID": this.mdriver.getMessageID(),
      "data": newdata
		});  
  }

  setPercentageOpen(perc) {
    let pos = this.mdriver.percentageOpenToPosition(perc);
    this.log(this.getData().mac, 'setPosition', pos);
    switch (pos) {
      case this.mdriver.Position.Open_Up:    this.setCapabilityState('up');   break;
      case this.mdriver.Position.Close_Down: this.setCapabilityState('down'); break;      
    }
    this.writeDevice({ "targetPosition": pos });    
  }

  setPercentageTilt(perc) {
    let pos = this.mdriver.percentageTiltToAngle(perc);
    this.log(this.getData().mac, 'setAngle', pos);
    this.writeDevice({ "targetAngle": pos });    
  }

  openUp() {
    this.log(this.getData().mac, 'OpenUp');
    this.writeDevice({ "operation": this.mdriver.Operation.Open_Up });    
  }

  closeDown() {
    this.log(this.getData().mac, 'CloseDown');
    this.writeDevice({ "operation": this.mdriver.Operation.Close_Down });    
  }

  stop() {
    this.log(this.getData().mac, 'stop');
    this.writeDevice({ "operation": this.mdriver.Operation.Stop });    
  }

  statusQuery() {
    this.log(this.getData().mac, 'statusQuery');
    this.writeDevice({ "operation": this.mdriver.Operation.StatusQuery });    
  }
}

module.exports = MotionDeviceGeneric;
