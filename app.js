// Support for MOTION Blinds by Coulisse, by Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('./motion/motion')


class MotionBlinds extends Homey.App {
  mdriver = null;

  async onInit() {
    this.mdriver = new MotionDriver(this);
    this.mdriver.on('newDevices', function() { this.onNewDevices(); }.bind(this));

    let blockAction = this.homey.flow.getActionCard('action_BLOCK_BLIND');
    let unblockAction = this.homey.flow.getActionCard('action_UNBLOCK_BLIND');
    let fullyOpenCondition = this.homey.flow.getConditionCard('condition_BLIND_FULLY_OPEN');
    let fullyClosedCondition = this.homey.flow.getConditionCard('condition_BLIND_FULLY_CLOSED');
    blockAction.registerRunListener(function(args, state)  { this.onBlockAction(args, state); }.bind(this));
    unblockAction.registerRunListener(function(args, state)  { this.onUnblockAction(args, state); }.bind(this));
    fullyOpenCondition.registerRunListener(function(args, state)  { return this.onFullyOpenCondition(args, state); }.bind(this));
    fullyClosedCondition.registerRunListener(function(args, state)  { return this.onFullyClosedCondition(args, state); }.bind(this));
    this.homey.settings.on('set',   function() { this.onSaveSettings(); }.bind(this));
    this.homey.settings.on('unset', function() { this.onClearSettings(); }.bind(this));
    this.onSaveSettings();
    this.mdriver.connect();
    this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);
  }

  onSaveSettings() {
    this.mdriver.verbose = this.homey.settings.get('debug') == true;
    let key = this.homey.settings.get('motion_key');
    if (key != null && key != undefined && key.length == 16)
      try {
        this.mdriver.setAppKey(key);
      } catch (error) {
        this.mdriver.setAppKey(null);
        this.error(error);
      }
  }

  async onClearSettings() {
    this.mdriver.setAppKey(null);
    this.mdriver.verbose = false;
  }

  onBlockAction(args, state) {
    if (args.device != undefined)
      args.device.onBlockAction(args, state);
  }
   
  onUnblockAction(args, state) {
    if (args.device != undefined)
      args.device.onUnblockAction(args, state);
  }

  async onFullyClosedCondition(args, state) {
    if (args.device != undefined)
      return args.device.onFullyClosedCondition(args, state);
    return undefined;
  }
   
  async onFullyOpenCondition(args, state) {
    if (args.device != undefined)
      return args.device.onFullyOpenCondition(args, state);
    return undefined;
  }
   
  async onNewDevices() { // a new gateway is added, poll unknown devices
    this.log('New devices discovered');
    this.mdriver.pollStates(false);
  }
  
  getDeviceTypeName(id)   { return this.homey.__('DeviceType.' + id); }
  getBlindTypeName(id)    { return this.homey.__('BlindType.' + id); }
  getOperationName(id)    { return this.homey.__('Operation.' + id); }
  getPositionName(id)     { return this.homey.__('Position.' + id); }
  getAngleName(id)        { return this.homey.__('Angle.' + id); }
  getLimitStatusName(id)  { return this.homey.__('LimitStatus.' + id); }
  getVoltageModeName(id)  { return this.homey.__('VoltageMode.' + id); }
  getWirelessModeName(id) { return this.homey.__('WirelessMode.' + id); }
}

module.exports = MotionBlinds;

