// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('../motion/motion')

class MotionDeviceGeneric extends Homey.Device {
  async onInit() {
    this.mdriver = this.homey.app.mdriver;
    let mac = this.getData().mac;
    this.expectReportTimer = undefined;
    this.registerCapabilityListener('windowcoverings_set', this.onCapabilityWindowcoverings_set.bind(this));
    this.registerCapabilityListener('windowcoverings_tilt_set', this.onCapabilityWindowcoverings_tilt_set.bind(this));
    this.registerCapabilityListener('windowcoverings_state', this.onCapabilityWindowcoverings_state.bind(this));
    this.registerCapabilityListener('measure_battery', this.onCapabilityMeasure_battery.bind(this));
    this.registerCapabilityListener('state_mb_part_closed', this.onCapabilityState_mb_part_closed.bind(this));
    this.registerCapabilityListener('alarm_contact', this.onCapabilityAlarm_contact.bind(this));
    this.mdriver.on('newDevice', function(newmac) { if (mac == newmac) this.onNewDevice(); }.bind(this));
    this.mdriver.on('Report', function(msg, info) { if (mac == msg.mac) this.onReport(msg, info); }.bind(this));
    this.mdriver.on('ReadDeviceAck', function(msg, info) { if (mac == msg.mac) this.onReadDeviceAck(msg, info); }.bind(this));
    this.mdriver.on('WriteDevice', function(msg, info) { if (mac == msg.mac) this.onWriteDevice(msg, info); }.bind(this));
    this.mdriver.on('WriteDeviceAck', function(msg, info) { if (mac == msg.mac) this.onWriteDeviceAck(msg, info); }.bind(this));
    this.log(this.getName(), 'at', mac, 'initialized');
    this.checkAlarmContactCapability();
    this.onNewDevice();
  }

  onNewDevice() { // the motiondriver now knows me, so register
    if (this.mdriver.registerDevice(this.getData().mac)) { // check if set. onInit calls this too so it may already be done
      this.mdriver.setDeviceInGroup(this.getData().mac, this.getSetting('inRemoteGroup'));
      let wirelessMode = this.getSetting('wirelessMode');
      if (wirelessMode == this.mdriver.WirelessMode.BiDirection || wirelessMode == this.mdriver.WirelessMode.BidirectionMech) 
          this.readDevice();
        else
          this.statusQuery();
    }
  }

  async onAdded() {
    this.log(this.getName(), 'at', this.getData().mac, 'added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.mdriver.setDeviceInGroup(this.getData().mac, newSettings.inRemoteGroup);
    this.log(this.getData().mac, 'changed settings', newSettings);
  }

  async onRenamed(name) {
    this.log(this.getData().mac, 'renamed to', name);
  }

  async onDeleted() {
    this.log(this.getData().mac, 'deleted');
    this.mdriver.registerDevice(this.getData().mac, false);
  }
   
  async onBlockAction(args, state) {
    if (this.hasCapability('alarm_contact')) {
      this.log(this.getData().mac, 'blocked');
      this.setCapabilityValue('alarm_contact', true);
    }
  }
   
  async onUnblockAction(args, state) {
    if (this.hasCapability('alarm_contact')) {
      this.log(this.getData().mac, 'unblocked');
      this.setCapabilityValue('alarm_contact', false);
    }
  }
   
  async onFullyOpenCondition(args, state) {
    let open = this.hasCapability('windowcoverings_set')
      ? (this.getCapabilityValue('windowcoverings_set') > 0.95) 
      : (this.getCapabilityValue('windowcoverings_state') == 'up');
    this.log(this.getData().mac, 'check fully Opened', open);
    return open;
  }
   
  async onFullyClosedCondition(args, state) {
    let open = this.hasCapability('windowcoverings_set')
      ? (this.getCapabilityValue('windowcoverings_set') < 0.05) 
      : (this.getCapabilityValue('windowcoverings_state') == 'down');
    this.log(this.getData().mac, 'check fully Closed', open);
    return open;
  }
   
  async onCapabilityWindowcoverings_set(value, opts) {
    this.log(this.getData().mac, 'onCapabilityWindowcoverings_set', value, opts);
    this.setCapabilityPartClosed(value);
    this.setPercentageOpen(value);
  }

  async onCapabilityWindowcoverings_tilt_set(value, opts) {
    this.log(this.getData().mac, 'onCapabilityWindowcoverings_tilt_set', value);
    this.setPercentageTilt(value);
  }

  async onCapabilityState_mb_part_closed(value, opts) {
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

  async onCapabilityAlarm_contact(value, opts) {
    this.log(this.getData().mac, 'onCapabilityAlarm_contact', value, opts);
    this.checkAlarmContactCapability();
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
      let newSettings = {};
      let settings = this.getSettings();
      if (settings == undefined)
        settings = { };
      if (settings.deviceTypeName == undefined || settings.deviceTypeName == '?') {
        newSettings.deviceTypeName = this.homey.app.getDeviceTypeName(this.getData().deviceType);
        if (newSettings.deviceTypeName == null || newSettings.deviceTypeName == undefined || newSettings.deviceTypeName == '?')
          newSettings.deviceTypeName = '-';
        save = true;
      }
      if (msg.data.type != undefined) {
        if (msg.data.type == this.mdriver.BlindType.VenetianBlind || 
            msg.data.type == this.mdriver.BlindType.ShangriLaBlind) {
          if (!this.hasCapability('windowcoverings_tilt_set'))
            this.addCapability('windowcoverings_tilt_set')
        } else {
          if (this.hasCapability('windowcoverings_tilt_set'))
            this.removeCapability('windowcoverings_tilt_set')
        }
        if (msg.data.type != settings.type || settings.typeName == undefined || settings.typeName == '?') { 
            newSettings.type = msg.data.type; 
            newSettings.typeName = this.homey.app.getBlindTypeName(msg.data.type);
            if (newSettings.typeName == null || newSettings.typeName == undefined || newSettings.typeName == '?')
              newSettings.typeName = '-';
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
        if (msg.data.voltageMode != settings.voltageMode || settings.voltageModeName == undefined || settings.voltageModeName == '?') { 
          newSettings.voltageMode = msg.data.voltageMode; 
          newSettings.voltageModeName = this.homey.app.getVoltageModeName(msg.data.voltageMode);
          if (newSettings.voltageModeName == null || newSettings.voltageModeName == undefined ||  newSettings.voltageModeName == '?')
            newSettings.voltageModeName = '-';
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
        if (msg.data.wirelessMode != settings.wirelessMode || settings.wirelessModeName == undefined || settings.wirelessModeName == '?') { 
          newSettings.wirelessMode = msg.data.wirelessMode; 
          newSettings.wirelessModeName = this.homey.app.getWirelessModeName(msg.data.wirelessMode);
          if (newSettings.wirelessModeName == null || newSettings.wirelessModeName == undefined || newSettings.wirelessModeName == '?')
            newSettings.wirelessModeName = '-';
          save = true; 
          }
      }
      if (save) {
        this.log(this.getData().mac, 'Save settings ', newSettings);
        this.setSettings(newSettings);
      } 
    }
  }

  async checkAlarmContactCapability() {
    if (this.getSetting('addBlockAlarm')) {
      if (!this.hasCapability('alarm_contact'))
        this.addCapability('alarm_contact');
        if (!this.hasCapability('alarm_contact')) {
        this.addCapability('alarm_contact');
        this.setCapabilityOptions('alarm_contact', { "zoneActivity": false });
      }
    } else if (this.hasCapability('alarm_contact'))
      this.removeCapability('alarm_contact');
  }

  async onReport(msg, info) {
    this.log(this.getData().mac, 'onReport');
    this.setStates(msg);
    this.checkSettings(msg);
    if (this.expectReportTimer != undefined) {  // got the report as expected, don't force read state by the timer
      clearTimeout(this.expectReportTimer);
      this.expectReportTimer = undefined;
    } else if (this.getSetting('inRemoteGroup')) { // if a report cones in unannounced, it is often due to a remote. Bad news is, if a remote is tied to several blinds, only one reports. So, if it is part of a group, poll them all
      this.log(this.getData().mac, 'unexpected Report triggered poll');
      this.mdriver.pollStates(true, true);
    }
  }

  async onReadDeviceAck(msg, info) {
    this.log(this.getData().mac, 'onReadDeviceAck');
    this.setStates(msg);
    this.checkSettings(msg);
  }

  async onWriteDevice(msg, info) {
    this.log(this.getData().mac, 'onWriteDevice');
    this.setStates(msg);
  }

  async onWriteDeviceAck(msg, info) {
    this.log(this.getData().mac, 'onWriteDeviceAck');
    // this.setStates(msg, false);  don't set 'old' state, wait for result of change
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
    let timeout = this.getSetting('maxTravelTime');
    if (timeout == null ||  timeout == undefined)
      timeout = 60;
    else if (timeout < 5)
      timeout = 5;
    this.expectReportTimer = setTimeout(function() { // expect a report, if it does not come in a minute, read state by yourself
        this.log(this.getData().mac, 'onReportTimeout', timeout);
        this.expectReportTimer = undefined;
        this.readDevice();
      }.bind(this), 1000 * timeout); 
    this.mdriver.send({
			"msgType": 'WriteDevice',
			"mac": data.mac,
			"deviceType": data.deviceType,
			"accessToken": this.mdriver.getAccessTokenByID(data),
			"msgID": this.mdriver.getMessageID(),
      "data": newdata
		});  
  }

  async triggerBlocked(tokens = {}, state = {}) {
    let device = this; // We're in a Device instance
    this.driver.ready().then(() => { 
      device.log('Trigger flow blocked cards');
      device.driver.triggerBlockedFlow(device, tokens, state); 
    });
  }

  setPercentageOpen(perc) {
    let pos = this.mdriver.percentageOpenToPosition(perc);
    if (pos != this.mdriver.Position.Open_Up && this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
      this.log(this.getData().mac, 'CloseDownBlocked');
      this.readDevice();
      this.triggerBlocked();
    } else {
      this.log(this.getData().mac, 'setPosition', pos);
      switch (pos) {
        case this.mdriver.Position.Open_Up:    this.setCapabilityState('up');   break;
        case this.mdriver.Position.Close_Down: this.setCapabilityState('down'); break;      
      }
      this.writeDevice({ "targetPosition": pos });    
    }
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
    if (this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
      this.log(this.getData().mac, 'CloseDownBlocked');
      if (this.hasCapability('windowcoverings_set'))
        this.readDevice();
      else
        this.scheduleStop();
      this.triggerBlocked();
    } else {
      this.log(this.getData().mac, 'CloseDown');
      this.writeDevice({ "operation": this.mdriver.Operation.Close_Down });    
    }
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
