// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriverGeneric = require('../genericdriver')

class MotionDriverBlind extends MotionDriverGeneric {

  getAllowedDeviceTypes() {
    let mdriver = this.homey.app.mdriver;
    return [ 
      // mdriver.DeviceType.DoubleRoller,
      mdriver.DeviceType.Blind
    ];
  }

  getAllowedBlindTypes() { 
    let mdriver = this.homey.app.mdriver;
    return [
      mdriver.BlindType.RollerBlind,
      mdriver.BlindType.RomanBlind,
      mdriver.BlindType.HoneycombBlind,
      mdriver.BlindType.RollerShutter,
      mdriver.BlindType.RollerGate,
      mdriver.BlindType.Awning,
      mdriver.BlindType.DayNightBlind,
      mdriver.BlindType.DimmingBlind,
      // mdriver.BlindType.DoubleRoller, 
      mdriver.BlindType.Switch
    ]; 
  }

  getDefaultName() {
    return this.homey.__('blind.defaultName');
  }
}

module.exports = MotionDriverBlind;