// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriverGeneric = require('../genericdriver');

class MotionDriverVenetian extends MotionDriverGeneric {

  getAllowedDeviceTypes() {
    return this.homey.app.mdriver.DeviceType.Blind;
  }

  getAllowedBlindTypes() { 
    let mdriver = this.homey.app.mdriver;
    return [
      mdriver.BlindType.VenetianBlind,
      mdriver.BlindType.ShangriLaBlind
  ]; 
  }

  getDefaultName() {
    return this.homey.__('venetian.defaultName');
  }
}

module.exports = MotionDriverVenetian;