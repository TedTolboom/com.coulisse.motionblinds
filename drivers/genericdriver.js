// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('../motion/motion');

class MotionDriverGeneric extends Homey.Driver {
  async onInit() {
    this.flowTriggerBlocked = this.homey.flow.getDeviceTriggerCard('trigger_BLIND_BLOCKED');
    this.log('Initialized');
  }

  triggerBlockedFlow(device, tokens, state) {
    this.flowTriggerBlocked.trigger(device, tokens, state)
      .then(this.log)
      .catch(this.error);
  }

  getDefaultName() {
    return this.homey.__('generic.defaultName');
  }

  getTypeName(type) {
    let name = type == undefined ? null : this.homey.app.getBlindTypeName(type);
    if (name == null || name == undefined)
      name = this.getDefaultName();
    return name + ' ' + this.homey.__('generic.nr');
  }

  getAllowedTypes() { 
    return unknown; 
  }

  getDeviceType() {
    return unknown;
  }

  getAvailableDevices(mdriver) {
    return mdriver.getDevices(this.getDeviceType(), function (id) {
      let ok = !id.registered && (this.getAllowedTypes() == undefined ||
        id.type == undefined || this.getAllowedTypes().includes(id.type));
      this.log('filter', ok, id);
      return ok;
    }.bind(this));
  }

  async onPairListDevices() {
    try {
      this.log('Pairing');
      let mdriver = this.homey.app.mdriver;
      this.log('Allowed', this.getAllowedTypes());
      let devices = this.getAvailableDevices(mdriver);
        this.log('Devices available at start pairing', devices);
        let pairedDriverDevices = [];
        this.getDevices().forEach(device => pairedDriverDevices.push(device.getData().mac));
        this.log('Paired', pairedDriverDevices);
        const results = devices.filter(device => !pairedDriverDevices.includes(device.mac))
          .map((r, i) => ({ 
              name: this.getTypeName(r.type) + ' ' + r.mac.substr(r.mac.length - 4), 
              data: {
                  mac: r.mac, 
                  deviceType: r.deviceType
              }  
          }));
        this.log(this.getDefaultName(), 'pairable', results);
        return Promise.resolve(results);
    } catch (exception) {
       this.homey.app.error(exception); 
    }
  }
}

module.exports = MotionDriverGeneric;