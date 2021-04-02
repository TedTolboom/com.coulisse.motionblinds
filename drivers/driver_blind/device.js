// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');

class MotionDeviceBlinds extends Homey.Device {
  async onInit() {
    this.motiondriver = this.homey.app.driver;
    //this.motiondriver.verbose = true;
    let blind = this;
    let mac = this.getData().mac;
    this.expectReportTimer = undefined;
    this.motiondriver.on('Report', function(msg, info) { if (mac == msg.mac) blind.onReport(msg, info); });
    this.motiondriver.on('ReadDeviceAck', function(msg, info) { if (mac == msg.mac) blind.onReadDeviceAck(msg, info); });
    this.motiondriver.on('WriteDeviceAck', function(msg, info) { if (mac == msg.mac) blind.onWriteDeviceAck(msg, info); });
    this.registerCapabilityListener('windowcoverings_set', this.onCapabilityWindowcoverings_set.bind(this));
    this.registerCapabilityListener('windowcoverings_state', this.onCapabilityWindowcoverings_state.bind(this));
    this.registerCapabilityListener('measure_battery', this.onCapabilityMeasure_battery.bind(this));
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
    this.log('Blind', this.getData().mac, 'onCapabilityWindowcoverings_set', value, opts);
    this.setPosition(value);
  }

  async onCapabilityWindowcoverings_state(value, opts) {
    this.log('Blind', this.getData().mac, 'onCapabilityWindowcoverings_state', value, opts);
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

  setStates(msg) {
    if (msg.data != undefined) {
      let state = undefined;
      switch(msg.data.operation) {
        case 0: state = 'down'; break;
        case 1: state = 'up';   break;
        case undefined: 
        case 2: state = 'idle'; break;
      }
      if (state != undefined) 
        this.setCapabilityValue('windowcoverings_state', state);
      let pos = undefined;
      if (msg.data.targetPosition != undefined) {
        switch (msg.data.targetPosition) {
          case 0:   state = 'up';   break;
          case 100: state = 'down'; break;
        }
        pos = 1 - Math.max(Math.min(msg.data.targetPosition / 100, 1), 0);
      } else if (msg.data.currentPosition != undefined) 
        pos = 1 - Math.max(Math.min(msg.data.currentPosition / 100, 1), 0);
      if (pos != undefined)
        this.setCapabilityValue('windowcoverings_set', pos);
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
      this.motiondriver.pollStates();
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
    var currentDriver = this;
    if (this.expectReportTimer) 
      clearTimeout(this.expectReportTimer); // expect report later if commands follow up quickly
    this.expectReportTimer = setTimeout(function() { // expect a report, if it does not come in a minute, read state by yourself
        currentDriver.log('Blind', currentDriver.getData().mac, 'onReportTimeout');
        currentDriver.expectReportTimer = undefined;
        currentDriver.readDevice();
      }, 60000); 
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
    switch (newpos) {
      case 0:   
        if (this.getCapabilityValue('windowcoverings_state') != 'up') 
          this.setCapabilityValue('windowcoverings_state', 'up');   
        break;
      case 100: 
        if (this.getCapabilityValue('windowcoverings_state') != 'down') 
          this.setCapabilityValue('windowcoverings_state', 'down'); 
        break;      
    }
    this.log('Blind', this.getData().mac, ' setPosition' + newpos);
    this.writeDevice({ targetPosition: newpos });    
  }

  up() {
    this.log('Blind', this.getData().mac, 'up');
    if (this.getCapabilityValue('windowcoverings_set') != 1)
      this.setCapabilityValue('windowcoverings_set', 1);
    this.writeDevice({ operation: 1 });    
  }

  down() {
    this.log('Blind', this.getData().mac, 'down');
    if (this.getCapabilityValue('windowcoverings_set') != 1)
      this.setCapabilityValue('windowcoverings_set', 1);
    this.writeDevice({ operation: 0 });    
  }

  stop() {
    this.log('Blind', this.getData().mac, 'stop');
    this.writeDevice({ operation: 2 });    
  }
}

module.exports = MotionDeviceBlinds;
