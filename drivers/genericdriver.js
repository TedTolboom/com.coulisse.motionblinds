// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('../motion/motion')

class MotionDriverGeneric extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MotionDriver initialized');
  }

  getDefaultName() {
    return this.homey.__('generic.defaultName');
  }

  getAllowedTypes() { 
    return unknown; 
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    try {
      this.log('Pairing');
      let mdriver = this.homey.app.mdriver;
      this.log('Allowed', this.getAllowedTypes());
      let devices = mdriver.getDevices(mdriver.DeviceType.Blind, function(id) { 
        this.log('filter', id);
          return !id.registered && (this.getAllowedTypes() == undefined || id.type == undefined || this.getAllowedTypes().includes(id.type));
        }.bind(this));
        this.log('Devices available at start pairing', devices);
        let pairedDriverDevices = [];
        this.getDevices().forEach(device => pairedDriverDevices.push(device.getData().mac));
        this.log('Paired', pairedDriverDevices);
        const results = devices.filter(device => !pairedDriverDevices.includes(device.mac))
          .map((r, i) => ({ 
              name: this.getDefaultName() + ' ' + r.mac.substr(r.mac.length - 4), 
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