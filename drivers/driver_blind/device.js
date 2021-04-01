// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');

class MotionDeviceBlinds extends Homey.Device {
  async onInit() {
    this.motiondriver = this.homey.app.driver;
    let blind = this;
    let mac = this.getData().mac;
    this.motiondriver.on('Report', function(msg, info) { if (mac == msg.mac) blind.onReport(msg, info); });
    this.motiondriver.on('ReadDeviceAck', function(msg, info) { if (mac == msg.mac) blind.onReadDeviceAck(msg, info); });
    this.motiondriver.on('WriteDeviceAck', function(msg, info) { if (mac == msg.mac) blind.onWriteDeviceAck(msg, info); });
    this.registerCapabilityListener('windowcoverings_set', this.onCapabilityWindowcoverings_set.bind(this));
    this.registerCapabilityListener('windowcoverings_state', this.onCapabilityWindowcoverings_state.bind(this));
    this.registerCapabilityListener('measure_battery', this.onCapabilityMeasure_battery.bind(this));
    this.homey.app.driver.verbose = true;
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
    this.setPosition(value);
    this.log('Blind onCapabilityWindowcoverings_set', this.getData().mac, 'handled', value, opts);
  }

  async onCapabilityWindowcoverings_state(value, opts) {
    switch(value) {
      case 'up': this.up(); break;
      case 'down': this.down(); break;
      case 'idle': this.stop(); break;
    }
    this.log('onCapabilityWindowcoverings_state', this.getData().mac, 'handled', value, opts);
  }

  async onCapabilityMeasure_battery(value, opts) {
    this.setCapabilityValue('measure_battery', value);
    this.log('onCapabilityMeasure_battery', this.getData().mac, 'handled', value, opts);
  }

  setStates(msg) {
    if (msg.data != undefined) {
      let state = undefined;
      switch(msg.data.operation) {
        case 0: state = 'down'; break;
        case 1: state = 'up'; break;
        case 2: state = 'idle'; break;
      }
      if (state != undefined) 
        this.setCapabilityValue('windowcoverings_state', state);
      if (msg.data.currentPosition != undefined  &&  msg.data.targetPosition == undefined) { // don't reset old position when acknowledging on set position
        let pos = Math.max(Math.min(1 - msg.data.currentPosition/100, 1), 0);
        this.setCapabilityValue('windowcoverings_set', pos);
      }
      if (msg.data.batteryLevel != undefined) {
        let battery = msg.data.batteryLevel / 10;
        this.setCapabilityValue('measure_battery', battery);
      }
    }
  }

  async onReport(msg, info) {
    this.setStates(msg);
    this.log('Blind onReport', this.getData().mac, 'handled');
  }

  async onReadDeviceAck(msg, info) {
    this.setStates(msg);
    this.log('Blind onReadDeviceAck', this.getData().mac, 'handled');
  }

  async onWriteDeviceAck(msg, info) {
    // this.setStates(msg, false);  don't set 'old' state, wait for result of change
    this.log('Blind onWriteDeviceAck', this.getData().mac, 'handled');
  }

  async readDevice() {
    let data = this.getData();
    this.motiondriver.send({
			msgType: 'ReadDevice',
			mac: data.mac,
			deviceType: data.deviceType,
			accessToken: this.motiondriver.getAccessTokenByID(data),
			msgID: this.motiondriver.getMessageID()
		});  
  }

  async writeDevice(newdata) {
    let data = this.getData();
    this.motiondriver.send({
			msgType: 'WriteDevice',
			mac: data.mac,
			deviceType: data.deviceType,
			accessToken: this.motiondriver.getAccessTokenByID(data),
			msgID: this.motiondriver.getMessageID(),
      data: newdata
		});  
  }

  setPosition(pos) {
    let newpos = 100 - Math.max(Math.min(Math.round(pos * 100), 100), 0);
    this.writeDevice({ targetPosition: newpos });    
  }

  up() {
    this.writeDevice({ operation: 1 });    
  }

  down() {
    this.writeDevice({ operation: 0 });    
  }

  stop() {
    this.writeDevice({ operation: 2 });    
  }

}

module.exports = MotionDeviceBlinds;
