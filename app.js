// Support for MOTION Blinds by Coulisse, by Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('./motion/motion')


class MotionBlinds extends Homey.App {
  mdriver = null;

  async onInit() {
    this.mdriver = new MotionDriver(this);
    this.mdriver.on('newDevices', function() { this.onNewDevices(); }.bind(this));

    this.mdriver.setAppKey(this.homey.settings.get('motion_key'));
    this.homey.settings.on('set', function() {
      this.mdriver.setAppKey(this.homey.settings.get('motion_key'));
    }.bind(this));
    this.homey.settings.on('unset', function() {
      this.mdriver.setAppKey(null);
    }.bind(this))
    this.mdriver.connect();
    this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);
  }

  async onNewDevices() { // a new gateway is added, poll unknown devices
    this.log('New devices discovered');
    this.mdriver.pollStates(false);
  }
}

module.exports = MotionBlinds;

