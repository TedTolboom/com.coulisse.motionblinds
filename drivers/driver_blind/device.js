// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('../../motion/motion')

class MotionDeviceBlinds extends Homey.Device {
  async onInit() {
    this.mdriver = this.homey.app.mdriver;
    let mac = this.getData().mac;
    this.expectReportTimer = undefined;
    let blind = this;
    this.registerCapabilityListener('windowcoverings_set', this.onCapabilityWindowcoverings_set.bind(this));
    this.registerCapabilityListener('windowcoverings_state', this.onCapabilityWindowcoverings_state.bind(this));
    this.registerCapabilityListener('measure_battery', this.onCapabilityMeasure_battery.bind(this));
    this.mdriver.on('Report', function(msg, info) { if (mac == msg.mac) blind.onReport(msg, info); });
    this.mdriver.on('ReadDeviceAck', function(msg, info) { if (mac == msg.mac) blind.onReadDeviceAck(msg, info); });
    this.mdriver.on('WriteDeviceAck', function(msg, info) { if (mac == msg.mac) blind.onWriteDeviceAck(msg, info); });
    this.readDevice();
    this.log('Blind', mac, 'initialised');
  }

  async onAdded() {
    this.log('Blind', this.getData().mac, 'added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Blind', this.getData().mac, 'changed settings');
  }

  async onRenamed(name) {
    this.log('Blind', this.getData().mac, 'renamed to', name);
  }

  async onDeleted() {
    this.log('Blind', this.getData().mac, 'deleted');
  }
   
  async onCapabilityWindowcoverings_set(value, opts) {
    this.log('Blind', this.getData().mac, 'onCapabilityWindowcoverings_set', value);
    this.setPercentageOpen(value);
  }

  async onCapabilityWindowcoverings_state(value, opts) {
    this.log('Blind', this.getData().mac, 'onCapabilityWindowcoverings_state', value);
    switch(value) {
      case 'up': this.up(); break;
      case 'down': this.down(); break;
      case 'idle': this.stop(); break;
    }
  }

  async onCapabilityMeasure_battery(value, opts) {
    this.log('Blind', this.getData().mac, 'onCapabilityMeasure_battery', value, opts);
    this.setCapabilityValue('measure_battery', value);
  }

  setCapabilityState(state) {
    if (state != undefined && this.getCapabilityValue('windowcoverings_state') != state) {
      this.log('Blind', this.getData().mac, 'setCapabilityState', state);
      this.setCapabilityValue('windowcoverings_state', state);
    }
  }

  setCapabilityPercentage(perc) {
    if (perc != undefined && (Math.abs(this.getCapabilityValue('windowcoverings_set') - perc) >= 0.05)) {
      this.log('Blind', this.getData().mac, 'setCapabilityPercentage', perc);
      this.setCapabilityValue('windowcoverings_set', perc);
    }
  }

  setStates(msg) {
    if (msg.data != undefined) {
      let state = undefined;
      let perc = undefined;
      if (msg.data.targetPosition != undefined) {
        state = 'idle';
        switch (msg.data.targetPosition) {
          case this.mdriver.Position.Up_Open:    state = 'up';   break;
          case this.mdriver.Position.Close_Down: state = 'down'; break;
        }
        perc = this.mdriver.positionToPercentageOpen(msg.data.targetPosition);
      } else if (msg.data.currentPosition != undefined) {
        perc = this.mdriver.positionToPercentageOpen(msg.data.currentPosition);
        state = 'idle';
      }
      switch(msg.data.operation) {
        case this.mdriver.Operation.Close_Down: state = 'down'; perc = 0; break;
        case this.mdriver.Operation.Open_Up:    state = 'up';   perc = 1; break;
        case this.mdriver.Operation.Stop:       state = 'idle'; break;
      }
      this.setCapabilityState(state);
      this.setCapabilityPercentage(perc);
      if (msg.data.batteryLevel != undefined) {
        let battery = msg.data.batteryLevel / 10;
        this.setCapabilityValue('measure_battery', battery);
      }
    }
  }

  async onReport(msg, info) {
    this.log('Blind', this.getData().mac, 'onReport');
    this.setStates(msg);
    if (this.expectReportTimer != undefined) {  // got the report as expected, don't force read state by the timer
      clearTimeout(this.expectReportTimer);
      this.expectReportTimer = undefined;
    } else { // if a report cones in unannounced, it is often due to a remote. Bad news is, if a remote is tied to several blinds, only one reports. So, poll them all
      this.log('Blind', this.getData().mac, 'unexpected Report triggered poll');
      this.mdriver.pollStates();
    }
  }

  async onReadDeviceAck(msg, info) {
    this.log('Blind', this.getData().mac, 'onReadDeviceAck');
    this.setStates(msg);
  }

  async onWriteDeviceAck(msg, info) {
    // this.setStates(msg, false);  don't set 'old' state, wait for result of change
    this.log('Blind', this.getData().mac, 'onWriteDeviceAck');
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
    var currentDriver = this;
    if (this.expectReportTimer) 
      clearTimeout(this.expectReportTimer); // expect report later if commands follow up quickly
    this.expectReportTimer = setTimeout(function() { // expect a report, if it does not come in a minute, read state by yourself
        currentDriver.log('Blind', currentDriver.getData().mac, 'onReportTimeout');
        currentDriver.expectReportTimer = undefined;
        currentDriver.readDevice();
      }, 60000); 
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
    this.log('Blind', this.getData().mac, 'setPosition', pos);
    switch (pos) {
      case this.mdriver.Position.Open_Up:    this.setCapabilityState('up');   break;
      case this.mdriver.Position.Close_Down: this.setCapabilityState('down'); break;      
    }
    this.writeDevice({ "targetPosition": pos });    
  }

  up() {
    this.log('Blind', this.getData().mac, 'up');
    this.setCapabilityPercentage(1);
    this.writeDevice({ "operation": this.mdriver.Operation.Open_Up });    
  }

  down() {
    this.log('Blind', this.getData().mac, 'down');
    this.setCapabilityPercentage(0);
    this.writeDevice({ "operation": this.mdriver.Operation.Close_Down });    
  }

  stop() {
    this.log('Blind', this.getData().mac, 'stop');
    this.writeDevice({ "operation": this.mdriver.Operation.Stop });    
  }
}

module.exports = MotionDeviceBlinds;
