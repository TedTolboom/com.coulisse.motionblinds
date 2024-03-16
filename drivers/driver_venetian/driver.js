// Motionblinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriverGeneric = require('../genericdriver');

class MotionDriverVenetian extends MotionDriverGeneric {

  getAllowedDeviceTypes() {
    let mdriver = this.homey.app.mdriver;
    return [ 
      mdriver.DeviceType.DoubleRoller,
      mdriver.DeviceType.Blind
    ];
  }

  getAllowedBlindTypes() { 
    let mdriver = this.homey.app.mdriver;
    return [
      mdriver.BlindType.VenetianBlind,
      mdriver.BlindType.ShangriLaBlind,
      mdriver.BlindType.DoubleRoller
   ]; 
  }

  getDefaultName() {
    return this.homey.__('venetian.defaultName');
  }
}

module.exports = MotionDriverVenetian;