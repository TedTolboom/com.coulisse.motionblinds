// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('../../motion/motion')

class MotionDriver_Blind extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MotionDriver initialized');
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    try {
      this.log('Pairing Blinds');
      let driver = this.homey.app.driver;
        let devices = driver.getDevices(driver.DeviceType.Blind);
        this.log('Blinds available at start pairing', devices);
        let pairedDriverDevices = [];
        this.getDevices().forEach(device => pairedDriverDevices.push(device.getData().mac));
        this.log('Paired Blinds', pairedDriverDevices);
        const results = devices.filter(device => !pairedDriverDevices.includes(device.mac))
          .map((r, i) => ({ 
              name: this.homey.__('blind.defaultName') + ' ' + r.mac.substr(r.mac.length - 4), 
              data: {
                  mac: r.mac, 
                  deviceType: r.deviceType
              }  
          }));
        this.log('Pairable Blinds', results);
        return Promise.resolve(results);
    } catch (exception) {
       this.homey.app.error(exception); 
    }
  }
}

module.exports = MotionDriver_Blind;