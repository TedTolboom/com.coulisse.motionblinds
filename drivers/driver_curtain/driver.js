// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriverGeneric = require('../genericdriver')

class MotionDriverCurtain extends MotionDriverGeneric {

  getAllowedTypes() { 
    let mdriver = this.homey.app.mdriver;
    return [
      mdriver.BlindType.Curtain,
      mdriver.BlindType.CurtainLeft,
      mdriver.BlindType.CurtainRight,
  ]; 
  }

  getDefaultName() {
    return this.homey.__('curtain.defaultName');
  }
}

module.exports = MotionDriverCurtain;