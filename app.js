// Support for Motionblinds by Coulisse, by Edwin Delsman
'use strict';

const Homey = require('homey');
const MotionDriver = require('./motion/motion')


class MotionblindsApp extends Homey.App {
  mdriver = null;

  async onInit() {
    this.mdriver = new MotionDriver(this, this.homey.clock.getTimezone());
    this.mdriver.on('newDevices', function() { this.onNewDevices(); }.bind(this));
    let blockAction = this.homey.flow.getActionCard('action_BLOCK_BLIND');
    let unblockAction = this.homey.flow.getActionCard('action_UNBLOCK_BLIND');
    let setTopStateAction = this.homey.flow.getActionCard('set_windowcoverings_state.top');
    let setBottomStateAction = this.homey.flow.getActionCard('set_windowcoverings_state.bottom');
    let setTopPositionAction = this.homey.flow.getActionCard('windowcoverings_set.top');
    let setBottomPositionAction = this.homey.flow.getActionCard('windowcoverings_set.bottom');
    let setTopBottomPositionAction = this.homey.flow.getActionCard('windowcoverings_set.top_bottom');
    let setTiltAction = this.homey.flow.getActionCard('action_windowcoverings_tilt_set');
    let fullyOpenCondition = this.homey.flow.getConditionCard('condition_BLIND_FULLY_OPEN');
    let fullyClosedCondition = this.homey.flow.getConditionCard('condition_BLIND_FULLY_CLOSED');
    let topStateIsCondition = this.homey.flow.getConditionCard('windowcoverings_state_is.top');
    let bottomStateIsCondition = this.homey.flow.getConditionCard('windowcoverings_state_is.bottom');
    let flowTriggerWindowcoverings_state_changed_top = this.homey.flow.getDeviceTriggerCard('windowcoverings_state_changed.top');
    let flowTriggerWindowcoverings_state_changed_bottom = this.homey.flow.getDeviceTriggerCard('windowcoverings_state_changed.bottom');
    setTopStateAction.registerRunListener(function(args, state)  { this.onSetTopStateAction(args, state); }.bind(this));
    setBottomStateAction.registerRunListener(function(args, state)  { this.onSetBottomStateAction(args, state); }.bind(this));
    setTopPositionAction.registerRunListener(function(args, state)  { this.onSetTopPositionAction(args, state); }.bind(this));
    setBottomPositionAction.registerRunListener(function(args, state)  { this.onSetBottomPositionAction(args, state); }.bind(this));
    setTopBottomPositionAction.registerRunListener(function(args, state)  { this.onSetTopBottomPositionAction(args, state); }.bind(this));
    setTiltAction.registerRunListener(function(args, state)  { this.onSetTiltAction(args, state); }.bind(this));
    blockAction.registerRunListener(function(args, state)  { this.onBlockAction(args, state); }.bind(this));
    unblockAction.registerRunListener(function(args, state)  { this.onUnblockAction(args, state); }.bind(this));
    fullyOpenCondition.registerRunListener(function(args, state)  { return this.onFullyOpenCondition(args, state); }.bind(this));
    fullyClosedCondition.registerRunListener(function(args, state)  { return this.onFullyClosedCondition(args, state); }.bind(this));
    topStateIsCondition.registerRunListener(function(args, state)  { return this.onTopStateIsCondition(args, state); }.bind(this));
    bottomStateIsCondition.registerRunListener(function(args, state)  { return this.onBottomStateIsCondition(args, state); }.bind(this));
    flowTriggerWindowcoverings_state_changed_top.registerRunListener(async (args, state) => { return args.state === state.state; });
    flowTriggerWindowcoverings_state_changed_bottom.registerRunListener(async (args, state) => { return args.state === state.state; });
    this.homey.settings.on('set', function() { this.onSaveSettings(); }.bind(this));
    this.homey.settings.on('unset', function() { this.onClearSettings(); }.bind(this));
    this.homey.clock.addListener('timezone', function(timezone) { 
      this.mdriver.setTomezone(timezone == undefined || timezone == null ? this.homey.clock.getTimezone() : timezone)}.bind(this));
    this.onSaveSettings();
    this.mdriver.connect();
    this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);
  }

  onSaveSettings(logChange = true) {
    this.mdriver.verbose = this.homey.settings.get('debug') == true;
    this.mdriver.logHeartbeat = this.mdriver.verbose;
    this.mdriver.multicast = this.homey.settings.get('multicast') == true;
    this.mdriver.multisocket = this.homey.settings.get('multisocket') == true;
    let key = this.homey.settings.get('motion_key');
    this.mdriver.setIP(this.homey.settings.get('motion_ip'));
    if (logChange)
      this.log("settings applied: verbose", this.mdriver.verbose, "multicast", this.mdriver.multicast, "multisocket", this.mdriver.multisocket, "IP", this.mdriver.ip);
    if (key != null && key != undefined && key.length == 16)
      try {
        this.mdriver.setAppKey(key);
        if (logChange)
          this.log('appkey set');
      } catch (error) {
        this.mdriver.setAppKey(null);
        this.error(error);
      }
  }

  async onClearSettings() {
    this.log('settings cleared');
    this.mdriver.setAppKey(null);
    this.mdriver.multicast = false;
    this.mdriver.verbose = false;
    this.mdriver.logHeartbeat = false;
    this.mdriver.setIP(undefined);
  }

  async onSetTiltAction(args, state) {
    if (args.device != undefined)
      args.device.onSetTiltAction(args, state);
  }
   
  async onBlockAction(args, state) {
    if (args.device != undefined)
      args.device.onBlockAction(args, state);
  }
   
  async onUnblockAction(args, state) {
    if (args.device != undefined)
      args.device.onUnblockAction(args, state);
  }

  async onSetTopStateAction(args, state) {
    if (args.device != undefined)
      args.device.onSetTopStateAction(args, state);
  }

  async onSetBottomStateAction(args, state) {
    if (args.device != undefined)
      args.device.onSetBottomStateAction(args, state);
  }

  async onSetTopBottomStateAction(args, state) {
    if (args.device != undefined)
      args.device.onSetTopBottomStateAction(args, state);
  }

  async onSetTopPositionAction(args, state) {
    if (args.device != undefined)
      args.device.onSetTopPositionAction(args, state);
  }

  async onSetBottomPositionAction(args, state) {
    if (args.device != undefined)
      args.device.onSetBottomPositionAction(args, state);
  }

  async onSetTopBottomPositionAction(args, state) {
    if (args.device != undefined)
      args.device.onSetTopBottomPositionAction(args, state);
  }

  async onTopStateIsCondition(args, state) {
    if (args.device != undefined)
      return args.device.onTopStateIsCondition(args, state);
    return undefined;
  }
   
  async onBottomStateIsCondition(args, state) {
    if (args.device != undefined)
      return args.device.onBottomStateIsCondition(args, state);
    return undefined;
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
    this.mdriver.pollStates(false, false, true);
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

module.exports = MotionblindsApp;

