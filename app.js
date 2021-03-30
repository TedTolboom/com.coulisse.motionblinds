'use strict';

const Homey = require('homey');
const MotionGateway = require('./motion/motion')


class MotionBlinds extends Homey.App {
  gateway = null;

  async onInit() {
    this.gateway = new MotionGateway(this);
    var gw = this.gateway;
    gw.setAppKey(this.homey.settings.get('motion_key'));
    this.homey.settings.on('set', function() {
      gw.setAppKey(this.homey.settings.get('motion_key'));
    });
    this.homey.settings.on('unset', function() {
      gw.setAppKey(null);
    })
    this.gateway.connect();
    this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);
  }
}

module.exports = MotionBlinds;

