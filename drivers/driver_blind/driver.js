// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriverGeneric = require('../genericdriver')

class MotionDriverBlind extends MotionDriverGeneric {

  getDeviceType() {
    return this.homey.app.mdriver.DeviceType.Blind;
  }

  getAllowedTypes() { 
    let mdriver = this.homey.app.mdriver;
    return [ // not sure, but allow all since the driver is generic anyway
      mdriver.BlindType.RollerBlind,
      mdriver.BlindType.RomanBlind,
      mdriver.BlindType.HoneycombBlind,
      mdriver.BlindType.RollerShutter,
      mdriver.BlindType.RollerGate,
      mdriver.BlindType.Awning,
      mdriver.BlindType.DimmingBlind,
      mdriver.BlindType.DoubleRoller, 
      mdriver.BlindType.Switch
    ]; 
  }

  getDefaultName() {
    return this.homey.__('blind.defaultName');
  }
}

module.exports = MotionDriverBlind;