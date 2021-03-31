// Support for MOTION Blinds by Coulisse, by Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('./motion/motion')


class MotionBlinds extends Homey.App {
  driver = null;

  async onInit() {
    this.driver = new MotionDriver(this);
    var gw = this.driver;
    gw.setAppKey(this.homey.settings.get('motion_key'));
    this.homey.settings.on('set', function() {
      gw.setAppKey(this.homey.settings.get('motion_key'));
    });
    this.homey.settings.on('unset', function() {
      gw.setAppKey(null);
    })
    this.driver.connect();
    this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);
  }
}

module.exports = MotionBlinds;

