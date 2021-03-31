'use strict';

const Homey = require('homey');

class MotionDeviceBlinds extends Homey.Device {
  async onInit() {
    this.log('Blind', this.getData().mac, 'initialised');
  }

  async onAdded() {
    this.log('Blind', this.getData().mac, 'added');
  }

  /**
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Blind', this.getData().mac, 'changed settings');
  }

  async onRenamed(name) {
    this.log('Blind', this.getData().mac, 'renamed to', name);
  }

  async onDeleted() {
    this.log('Blind', this.getData().mac, 'deleted');
  }
}

module.exports = MotionDeviceBlinds;
