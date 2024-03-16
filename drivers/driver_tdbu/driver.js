// Motionblinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriverGeneric = require('../genericdriver')

class MotionDriverTDBU extends MotionDriverGeneric {

  getAllowedDeviceTypes() {
    return this.homey.app.mdriver.DeviceType.TopDownBottomUp;
  }

  getAllowedBlindTypes() { 
    let mdriver = this.homey.app.mdriver;
    return [ 
      mdriver.BlindType.TopDownBottomUp
    ]; 
  }

  getDefaultName() {
    return this.homey.__('tdbu.defaultName');
  }

  // async onPairListDevices() {
  //   return [{ 
  //     name: "Testdevice", 
  //     data: {
  //         mac: "1234567890", 
  //         deviceType: '10000001'
  //     }  
  // }];
  // }
}

module.exports = MotionDriverTDBU;