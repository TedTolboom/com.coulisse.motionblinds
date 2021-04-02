// Support for MOTION Blinds by Coulisse, by Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('./motion/motion')


class MotionBlinds extends Homey.App {
  mdriver = null;

  async onInit() {
    this.mdriver = new MotionDriver(this);
    var gw = this.mdriver;
    gw.setAppKey(this.homey.settings.get('motion_key'));
    this.homey.settings.on('set', function() {
      gw.setAppKey(this.homey.settings.get('motion_key'));
    });
    this.homey.settings.on('unset', function() {
      gw.setAppKey(null);
    })
    this.mdriver.connect();
    this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);
  }
}

module.exports = MotionBlinds;

