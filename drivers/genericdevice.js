// Motion Blinds Support By Edwin Delsman
'use strict';

const Homey = require('homey');

class MotionDeviceGeneric extends Homey.Device {
  async onInit() {
    this.heartbeatCountRefresh = Math.round(345 + Math.random() * 30); // refresh about 4 times a day, every device slightly different interval to spread load
    this.heartbeatCount = Math.round(Math.random() * this.heartbeatCountRefresh / 2); // start at random interval too
    this.mdriver = this.homey.app.mdriver;
    this.expectReportTimer = undefined;
    this.maxAngle = this.mdriver.Angle.Close;
    let mac = this.getData().mac;
    this.registerCapabilityListener('windowcoverings_set', this.onCapabilityWindowcoverings_set.bind(this));
    this.registerCapabilityListener('windowcoverings_set.top', this.onCapabilityWindowcoverings_set_top.bind(this));
    this.registerCapabilityListener('windowcoverings_set.bottom', this.onCapabilityWindowcoverings_set_bottom.bind(this));
    this.registerCapabilityListener('windowcoverings_tilt_set', this.onCapabilityWindowcoverings_tilt_set.bind(this));
    this.registerCapabilityListener('windowcoverings_state', this.onCapabilityWindowcoverings_state.bind(this));
    this.registerCapabilityListener('windowcoverings_state.top', this.onCapabilityWindowcoverings_state_top.bind(this));
    this.registerCapabilityListener('windowcoverings_state.bottom', this.onCapabilityWindowcoverings_state_bottom.bind(this));
    this.registerCapabilityListener('measure_battery', this.onCapabilityMeasure_battery.bind(this));
    this.registerCapabilityListener('measure_battery.top', this.onCapabilityMeasure_battery_Top.bind(this));
    this.registerCapabilityListener('measure_battery.bottom', this.onCapabilityMeasure_battery_Bottom.bind(this));
    this.registerCapabilityListener('state_mb_part_closed', this.onCapabilityState_mb_part_closed.bind(this));
    this.registerCapabilityListener('alarm_contact', this.onCapabilityAlarm_contact.bind(this));
    this.mdriver.on('Heartbeat', function(msg, info) { this.onHeartbeat(msg, info); }.bind(this)); // is per gateway, do not check mac. Should test gateway, but too much work and not really worth the trouble
    this.mdriver.on('newDevice', function(newmac) { if (mac == newmac) this.onNewDevice(); }.bind(this));
    this.mdriver.on('Report', function(msg, info) { if (mac == msg.mac) this.onReport(msg, info); }.bind(this));
    this.mdriver.on('ReadDeviceAck', function(msg, info) { if (mac == msg.mac) this.onReadDeviceAck(msg, info); }.bind(this));
    this.mdriver.on('WriteDevice', function(msg, info) { if (mac == msg.mac) this.onWriteDevice(msg, info); }.bind(this));
    this.mdriver.on('WriteDeviceAck', function(msg, info) { if (mac == msg.mac) this.onWriteDeviceAck(msg, info); }.bind(this));
    this.log(this.getName(), 'at', mac, 'initialized, refreshed every', this.heartbeatCountRefresh, 'heartbeats, starting at', this.heartbeatCount);
    this.checkAlarmContactCapability(this.getSetting('addBlockAlarm'));
    this.onNewDevice();
  }

  onNewDevice() { // the motiondriver now knows me, so register
    if (this.mdriver.registerDevice(this.getData().mac)) { // check if set. onInit calls this too so it may already be done
      this.mdriver.setDeviceInGroup(this.getData().mac, this.getSetting('inRemoteGroup'));
      this.statusQuery(); // this seems to update battery, whereas read does not. This is also why evert nth heartbeat a status query is done
    }
  }

  async onAdded() {
    this.log(this.getName(), 'at', this.getData().mac, 'added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.mdriver.setDeviceInGroup(this.getData().mac, newSettings.inRemoteGroup);
    this.checkAlarmContactCapability(newSettings.addBlockAlarm);
    this.checkTopBottomStateCapabilities(newSettings.separateTopDownButtons);
    this.checkBatteryCapability(true, this.getData().deviceType, newSettings.separateBatteryStates);
    this.log('changed settings', newSettings);
  }

  async onRenamed(name) {
    this.log('renamed to', name);
  }

  async onDeleted() {
    this.log('deleted');
    this.mdriver.registerDevice(this.getData().mac, false);
  }
   
  async triggerBlocked(tokens = {}, state = {}) {
    let device = this; 
    this.driver.ready().then(() => { 
      if (device.mdriver.verbose)
        device.log('triggerBlocked', tokens, state);
      device.driver.triggerBlockedFlow(device, tokens, state); 
    });
  }

  async triggerTopStateChanged(value, tokens = {}, state = {}) {
    if (value != undefined) {
      let device = this;
      state.state = value;
      this.driver.ready().then(() => { 
        if (device.mdriver.verbose)
          device.log('triggerTopStateChanged', tokens, state);
        device.driver.triggerTopStateChangedFlow(device, tokens, state); 
      });
    }
  }

  async triggerBottomStateChanged(value, tokens = {}, state = {}) {
    if (value != undefined) {
      let device = this; 
      state.state = value;
      this.driver.ready().then(() => { 
        if (device.mdriver.verbose)
          device.log('triggerBottomStateChanged', tokens, state);
        device.driver.triggerBottomStateChangedFlow(device, tokens, state); 
      });
    }
  }

  async triggerTopPositionChanged(perc, tokens = {}, state = {}) {
    if (perc != undefined) {
      let device = this; 
      tokens.windowcoverings_set_top = perc;
      this.driver.ready().then(() => { 
        if (device.mdriver.verbose)
          device.log('triggerTopPositionChanged', tokens, state);
        device.driver.triggerTopPositionChangedFlow(device, tokens, state); 
      });
    }
  }

  async triggerBottomPositionChanged(perc, tokens = {}, state = {}) {
    if (perc != undefined) {
      let device = this;
      tokens.windowcoverings_set_bottom = perc;
      this.driver.ready().then(() => { 
        if (device.mdriver.verbose)
          device.log('triggerBottomPositionChanged', tokens, state);
        device.driver.triggerBottomPositionChangedFlow(device, tokens, state); 
      });
    }
  }

  async onTopStateIsCondition(args, state) {
    let isState = this.getCapabilityValue('windowcoverings_state.top') == args.state;
    if (this.mdriver.verbose)
      this.log('onTopStateIsCondition', args.state, isState, state);
    return isState;
  }
   
  async onBottomStateIsCondition(args, state) {
    let isState = this.getCapabilityValue('windowcoverings_state.bottom') == args.state;
    if (this.mdriver.verbose)
      this.log('onBottomStateIsCondition', args.state, isState, state);
    return isState;
  }

  async onFullyOpenCondition(args, state) {
    let open = this.hasCapability('windowcoverings_set.top') && this.hasCapability('windowcoverings_set.bottom') 
    ? this.isFullyOpen(this.getCapabilityValue('windowcoverings_set.top'), this.getCapabilityValue('windowcoverings_set.bottom'))
    : (this.hasCapability('windowcoverings_set') 
      ? (this.getCapabilityValue('windowcoverings_set') > 0.95) 
      : (this.getCapabilityValue('windowcoverings_state') == 'up'));
    if (this.mdriver.verbose)
      this.log('check fully Opened', open, state);
    return open;
  }
   
  async onFullyClosedCondition(args, state) {
    let open = this.hasCapability('windowcoverings_set.top') && this.hasCapability('windowcoverings_set.bottom') 
    ? this.isFullyClosed(this.getCapabilityValue('windowcoverings_set.top'), this.getCapabilityValue('windowcoverings_set.bottom'))
    : (this.hasCapability('windowcoverings_set')
      ? (this.getCapabilityValue('windowcoverings_set') < 0.05) 
      : (this.getCapabilityValue('windowcoverings_state') == 'down'));
    if (this.mdriver.verbose)
      this.log('check fully Closed', open, state);
    return open;
  }
   
  async onBlockAction(args, state) {
    if (this.hasCapability('alarm_contact') && !this.getCapabilityValue('alarm_contact')) {
      if (this.mdriver.verbose)
        this.log('blocked', state);
      this.setCapabilityValue('alarm_contact', true);
    }
  }
   
  async onUnblockAction(args, state) {
    if (this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
      if (this.mdriver.verbose)
        this.log('unblocked', state);
      this.setCapabilityValue('alarm_contact', false);
    }
  }
   
  async onSetTopStateAction(args, state) {
    if (this.mdriver.verbose)
      this.log('onSetTopStateAction', args.state, state);
    await this.onCapabilityWindowcoverings_state_top(args.state, state);
  }

  async onSetBottomStateAction(args, state) {
    if (this.mdriver.verbose)
      this.log('onSetBottomStateAction', args.state, state);
    await this.onCapabilityWindowcoverings_state_bottom(args.state, state);
  }

  async onSetTopPositionAction(args, state) {
    if (this.mdriver.verbose)
      this.log('onSetTopPositionAction', args.windowcoverings_set, state);
    await this.onCapabilityWindowcoverings_set_top(args.windowcoverings_set, state);
  }

  async onSetBottomPositionAction(args, state) {
    if (this.mdriver.verbose)
      this.log('onSetBottomPositionAction', args.windowcoverings_set, state);
    await this.onCapabilityWindowcoverings_set_bottom(args.windowcoverings_set, state);
  }

  async onSetTopBottomPositionAction(args, state) { // cannot check card easily, so if card is inverted, swap parameters
    let topPerc = args.windowcoverings_set_top < args.windowcoverings_set_bottom 
                      ? args.windowcoverings_set_bottom : args.windowcoverings_set_top;
    let bottomPerc = args.windowcoverings_set_top < args.windowcoverings_set_bottom 
                      ? args.windowcoverings_set_top : args.windowcoverings_set_bottom;
    if (this.mdriver.verbose)
      this.log('onSetTopBottomPositionAction', topPerc, bottomPerc, state);
      await this.onCapabilityWindowcoverings_set_top_bottom(topPerc, bottomPerc, state);
  }

  async onCapabilityWindowcoverings_set(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityWindowcoverings_set', value, opts);
    await this.setCapabilityPartClosed(value);
    await this.setPercentageOpen(value);
  }

  async onCapabilityWindowcoverings_set_top(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityWindowcoverings_set.top', value, opts);
    await this.setPercentageOpenTopBottom(value, undefined);
  }

  async onCapabilityWindowcoverings_set_bottom(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityWindowcoverings_set.bottom', value, opts);
    await this.setPercentageOpenTopBottom(undefined, value);
  }

  async onCapabilityWindowcoverings_set_top_bottom(valueTop, valueBottom, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityWindowcoverings_set.top.bottom', valueTop, valueBottom, opts);
    await this.setPercentageOpenTopBottom(valueTop, valueBottom);
  }

  async onCapabilityWindowcoverings_tilt_set(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityWindowcoverings_tilt_set', value);
    await this.setPercentageTilt(value, this.maxAngle);
  }

  async onCapabilityState_mb_part_closed(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilitystate_mb_part_closed', value, opts);
  }

  async onCapabilityWindowcoverings_state(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityWindowcoverings_state', value, opts);
    if (value == 'idle' && this.hasCapability('windowcoverings_set.bottom')) {
      await this.stateTopBottom(value == 'idle' ? 'idle' : 'up', value, opts, false);
    } else if (this.hasCapability('windowcoverings_set.bottom')) {  // dont use up/down to prevent double up/down triggers for top and bottom bar
      await this.setPercentageOpenTopBottom(1, (value == 'up' ? 1 : 0), false);
    } else {
      switch(value) {
        case 'up':   await this.openUp();    break;
        case 'down': await this.closeDown(); break;
        case 'idle': await this.stop();      break;
      }
    }
  }

  async onCapabilityWindowcoverings_state_top(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityWindowcoverings_state.top', value, opts);
    switch(value) {
      case 'up':   await this.openUpTop();    break;
      case 'down': await this.closeDownTop(); break;
      case 'idle': await this.stopTop();      break;
    }
  }

  async onCapabilityWindowcoverings_state_bottom(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityWindowcoverings_state.bottom', value, opts);
    switch(value) {
      case 'up':   await this.openUpBottom();    break;
      case 'down': await this.closeDownBottom(); break;
      case 'idle': await this.stopBottom();      break;
    }
  }

  async onCapabilityAlarm_contact(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityAlarm_contact', value, opts);
  }

  async onCapabilityMeasure_battery(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityMeasure_battery', value, opts);
    await this.setCapabilityValue('measure_battery', value);
  }

  async onCapabilityMeasure_battery_Top(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityMeasure_battery_Top', value, opts);
    await this.setCapabilityValue('measure_battery.top', value);
  }

  async onCapabilityMeasure_battery_Bottom(value, opts) {
    if (this.mdriver.verbose)
      this.log('onCapabilityMeasure_battery_bottom', value, opts);
    await this.setCapabilityValue('measure_battery.bottom', value);
  }

  numberDifferent(newval, oldval, treshold) {
    if (oldval == undefined || oldval == null)
      return (newval != null && newval != undefined);
    if ((newval == null || newval == undefined))
      return false;
    return Math.abs(oldval - newval) >= treshold;
  }

  isFullyOpen(topPerc, bottomPerc) {
    return topPerc > 0.95 && bottomPerc > 0.95;
  }

  isFullyClosed(topPerc, bottomPerc) {
    return topPerc > 0.95 && bottomPerc < 0.05;
  }

  async setCapabilityPartClosed(perc) {
    if (perc != undefined) {
      let pclosed = perc <= 0.99;
      if (this.hasCapability('state_mb_part_closed') && this.getCapabilityValue('state_mb_part_closed') != pclosed) {
        this.log('setCapabilityPartClosed', pclosed);
        await this.setCapabilityValue('state_mb_part_closed', pclosed);
      }
    }
  }

  async setCapabilityPartClosedTopBottom(percTop, percBottom) {
    if (percTop != undefined && percBottom != undefined) {
      let pclosed = !this.isFullyOpen(percTop, percBottom);
      if (this.hasCapability('state_mb_part_closed') && this.getCapabilityValue('state_mb_part_closed') != pclosed) {
        this.log('setCapabilityPartClosedTopBottom', pclosed);
        await this.setCapabilityValue('state_mb_part_closed', pclosed);
      }
    }
  }

  async setCapabilityState(state) {
    if (state == 'down' && !this.hasCapability('windowcoverings_set.bottom'))
      await this.setCapabilityPartClosed(0);
    if (state != undefined && this.getCapabilityValue('windowcoverings_state') != state) {
      this.log('setCapabilityState', state);
      await this.setCapabilityValue('windowcoverings_state', state);
    }
  }

  async setCapabilityStateTop(state, doState = true) {
    if (this.hasCapability('windowcoverings_state.top')) {
      if (state == 'up' || state == 'down')
        await this.setCapabilityPartClosedTopBottom(state == 'up' ? 1 : this.getCapabilityValue('windowcoverings_set.bottom'), 
                                              this.getCapabilityValue('windowcoverings_set.bottom'));
      if (state != undefined && this.getCapabilityValue('windowcoverings_state.top') != state) {
        this.log('setCapabilityStateTop', state);
        await this.setCapabilityValue('windowcoverings_state.top', state);
        this.triggerTopStateChanged(state);
        if (doState && this.hasCapability('windowcoverings_state') && this.getCapabilityValue('windowcoverings_state') != state)
          await this.setCapabilityState(state);
      }
    } else if (doState && this.hasCapability('windowcoverings_state') && this.getCapabilityValue('windowcoverings_state') != state) {
        await this.setCapabilityState(state);
    }
    return state;
  }

  async setCapabilityStateBottom(state, doState = true) {
    if (this.hasCapability('windowcoverings_state.bottom')) {
      if (state == 'up' || state == 'down')
        await this.setCapabilityPartClosedTopBottom(this.getCapabilityValue('windowcoverings_set.top'), 
                                              state == 'up' ? this.getCapabilityValue('windowcoverings_set.top') : 0);
      if (state != undefined && this.getCapabilityValue('windowcoverings_state.bottom') != state) {
        this.log('setCapabilityStateBottom', state);
        await this.setCapabilityValue('windowcoverings_state.bottom', state);
        this.triggerBottomStateChanged(state);
        if (doState && this.hasCapability('windowcoverings_state') && this.getCapabilityValue('windowcoverings_state') != state)
          await this.setCapabilityState(state);
      }
    } else if (doState && this.hasCapability('windowcoverings_state') && this.getCapabilityValue('windowcoverings_state') != state) {
      await this.setCapabilityState(state);
    }
  }

  async setCapabilityPercentage(perc) {
    await this.setCapabilityPartClosed(perc);
    if (perc != undefined && this.hasCapability('windowcoverings_set') && 
          this.numberDifferent(perc, this.getCapabilityValue('windowcoverings_set'), 0.05)) {
      this.log('setCapabilityPercentage', perc);
      await this.setCapabilityValue('windowcoverings_set', perc);
    }
  }

  async setCapabilityPercentageTopBottom(topPerc, bottomPerc) {
    let set = false;
    await this.setCapabilityPartClosedTopBottom(topPerc, bottomPerc);
    if (topPerc != undefined && this.hasCapability('windowcoverings_set.top') && 
          this.numberDifferent(topPerc, this.getCapabilityValue('windowcoverings_set.top'), 0.05)) {
      this.log('setCapabilityPercentage.top', topPerc);
      await this.setCapabilityValue('windowcoverings_set.top', topPerc);
      this.triggerTopPositionChanged(topPerc);
      set = true;
    }
    if (bottomPerc != undefined && this.hasCapability('windowcoverings_set.bottom') && 
          this.numberDifferent(bottomPerc, this.getCapabilityValue('windowcoverings_set.bottom'), 0.05)) {
      this.log('setCapabilityPercentage.bottom', bottomPerc);
      await this.setCapabilityValue('windowcoverings_set.bottom', bottomPerc);
      this.triggerBottomPositionChanged(bottomPerc);
      set = true;
    }
    return set;
  }

  async setCapabilityTiltPercentage(angle) {
    if (angle != undefined && this.hasCapability('windowcoverings_tilt_set') && 
          this.numberDifferent(angle, this.getCapabilityValue('windowcoverings_tilt_set'), 0.05)) {
      this.log('setCapabilityTiltPercentage', angle);
      await this.setCapabilityValue('windowcoverings_tilt_set', angle);
      return true;
    }
    return false;
  }

  async setCapabilityBattery(perc) {
    if (perc != undefined && this.hasCapability('measure_battery') && 
          this.numberDifferent(perc, this.getCapabilityValue('measure_battery'), 0.5)) {
      this.log('setCapabilityBattery', perc);
      await this.setCapabilityValue('measure_battery', perc);
      return true;
    }
    return false;
  }

  async setCapabilityBatteryTopBottom(topPerc, bottomPerc) {
    let set = false
    if (topPerc != undefined && this.hasCapability('measure_battery.top') && 
          this.numberDifferent(topPerc, this.getCapabilityValue('measure_battery.top'), 0.5)) {
      this.log('setCapabilityBatteryTop', topPerc);
      await this.setCapabilityValue('measure_battery.top', topPerc);
      set = true;
    }
    if (bottomPerc != undefined && this.hasCapability('measure_battery.bottom') && 
          this.numberDifferent(bottomPerc, this.getCapabilityValue('measure_battery.bottom'), 0.5)) {
      this.log('setCapabilityBatteryBottom', bottomPerc);
      await this.setCapabilityValue('measure_battery.bottom', bottomPerc);
      set = true;
    }
    if (topPerc != undefined && bottomPerc != undefined)
      set = this.setCapabilityBattery(Math.min(topPerc, bottomPerc));
    return set;
  }

  async setCapabilityRSSI(dBm) {
    if (dBm != undefined && this.numberDifferent(dBm, this.getCapabilityValue('measure_mb_rssi'), 0.5)) {
      this.log('setCapabilityRSSI', dBm);
      if (!this.hasCapability('measure_mb_rssi')) 
        await this.addCapability('measure_mb_rssi');
      await this.setCapabilityValue('measure_mb_rssi', dBm);
      return true;
    }
    return false;
  }

  async checkTiltCapability(on) {
    if (on != undefined) {
      if (on) {
        if (!this.hasCapability('windowcoverings_tilt_set'))
          await this.addCapability('windowcoverings_tilt_set')
      } else {
        if (this.hasCapability('windowcoverings_tilt_set'))
          this.removeCapability('windowcoverings_tilt_set')
      }
    }
  }

  async checkBatteryCapability(on, type, sep) {
    if (on != undefined) {
      if (on) {
        if (!this.hasCapability('measure_battery'))
          await this.addCapability('measure_battery');
      } else if (this.hasCapability('measure_battery'))
        this.removeCapability('measure_battery');
    }
    if (sep != undefined) {
      if (sep) {
        if (sep == true && type == this.mdriver.BlindType.TopDownBottomUp || 
              this.hasCapability('windowcoverings_set.top')) {
          if (!this.hasCapability('measure_battery.bottom'))
            await this.addCapability('measure_battery.bottom');
            if (!this.hasCapability('measure_battery.top'))
            await this.addCapability('measure_battery.top');
        } 
      } else {
        if (sep == true && type == this.mdriver.BlindType.TopDownBottomUp || 
              this.hasCapability('windowcoverings_set.top')) {
          if (this.hasCapability('measure_battery.bottom'))
            await this.removeCapability('measure_battery.bottom');
            if (this.hasCapability('measure_battery.top'))
            await this.removeCapability('measure_battery.top');
          } 
      }
    }
  }

  async checkPartClosedCapability(on) {
    if (on != undefined) {
      if (on) {
        if (!this.hasCapability('state_mb_part_closed')) 
          await this.addCapability('state_mb_part_closed');
      } else {
        if (this.hasCapability('state_mb_part_closed')) 
          this.removeCapability('state_mb_part_closed');
      }
    }
  }

  async checkSetCapability(on, type) {
    await this.checkSimpleSetCapability(on, type);
    await this.checkTDBUSetCapability(on, type);
  }

  async checkTDBUSetCapability(on, type) {
    if (type != undefined && on != undefined) {
        if (on && type == this.mdriver.BlindType.TopDownBottomUp) {
        if (!this.hasCapability('windowcoverings_set.bottom'))
          await this.addCapability('windowcoverings_set.bottom');
          if (!this.hasCapability('windowcoverings_set.top'))
          await this.addCapability('windowcoverings_set.top');
      } else {
        if (this.hasCapability('windowcoverings_set.bottom'))
          await this.removeCapability('windowcoverings_set.bottom');
          if (this.hasCapability('windowcoverings_set.top'))
          await this.removeCapability('windowcoverings_set.top');
      }
    }
  }

  async checkSimpleSetCapability(on, type) {
    if (type != undefined && on != undefined) {
      if (on && type != this.mdriver.BlindType.TopDownBottomUp) {
        if (!this.hasCapability('windowcoverings_set'))
          await this.addCapability('windowcoverings_set');
      } else {
        if (this.hasCapability('windowcoverings_set'))
          await this.removeCapability('windowcoverings_set');
      }
    }
  }

  async checkAlarmContactCapability(add) {
    if (add != undefined) {
      if (add) {
        if (!this.hasCapability('alarm_contact'))
          await this.addCapability('alarm_contact');
          if (!this.hasCapability('alarm_contact')) {
          await this.addCapability('alarm_contact');
          this.setCapabilityOptions('alarm_contact', { "zoneActivity": false });
        }
      } else if (this.hasCapability('alarm_contact'))
        this.removeCapability('alarm_contact');
    }
  }

  async checkBidirectionalCapability(on, type) {
    await this.checkPartClosedCapability(on);
    await this.checkSetCapability(on, type);
  }

  async checkTopBottomStateCapabilities(sep) {
    if (sep != undefined) {
      if (this.hasCapability('windowcoverings_state.bottom')) {
        if (!sep)
          await this.removeCapability('windowcoverings_state.bottom');
      } else if (sep)
        await this.addCapability('windowcoverings_state.bottom');
      if (this.hasCapability('windowcoverings_state.top')) {
        if (!sep)
          await this.removeCapability('windowcoverings_state.top');
      } else if (sep)
        await this.addCapability('windowcoverings_state.top');
      }
  }

  travelDirection(newperc, oldperc, noIdle = false) {
    if (oldperc == null || oldperc == undefined || newperc == null || newperc == undefined || 
        !this.numberDifferent(newperc, oldperc, 0.05))
      return noIdle ? undefined : 'idle';
    return newperc > oldperc ? 'up' : 'down';
  }

  scheduleStop() {
    setTimeout(function () {
      this.log('scheduledStop');
      this.setCapabilityState('idle');
    }.bind(this), 1250);
  }

  async setUpDownStates(msg) {
    let state = undefined;
    let perc = undefined;
    switch(msg.data.operation) { // beware! no difference between current and action! Do this first, because for write the others aren't there
      case this.mdriver.Operation.Close_Down: state = 'down'; perc = 0; break;
      case this.mdriver.Operation.Open_Up:    state = 'up';   perc = 1; break;
      case this.mdriver.Operation.Stop:       state = 'idle'; break;
    }
    if (msg.data.targetPosition != undefined) { // so if targetposition specified, overrule operation and current position
      perc = this.mdriver.positionToPercentageOpen(msg.data.targetPosition);
      state = this.travelDirection(perc, this.getCapabilityValue('windowcoverings_set'), true);
    } else if (msg.data.currentPosition != undefined) { // if currentposition received, overrule operation because then this is is not a state operation
      perc = this.mdriver.positionToPercentageOpen(msg.data.currentPosition);
      state = this.travelDirection(perc, this.getCapabilityValue('windowcoverings_set'));
      if (state != 'idle') { // this is a state report, not a state change, yet it is different from what we know, usually from remote. Signal the change, and force stop a little later.
        this.log('unexpected state change', state);
        this.scheduleStop(); 
      }
    }
    if (state != undefined && this.hasCapability('windowcoverings_state')) 
      await this.setCapabilityState(state);
    if (perc != undefined && this.hasCapability('windowcoverings_set'))
      await this.setCapabilityPercentage(perc);
  }

  async setTopBottomStates(msg) {
    let topState = undefined;
    let topPerc = undefined;
    let scheduleStop = false;
    switch(msg.data.operation_T) { // beware! no difference between current and action! Do this first, because for write the others aren't there
      case this.mdriver.Operation.Close_Down: topState = 'down'; topPerc = this.getCapabilityValue('windowcoverings_set.bottom'); break;
      case this.mdriver.Operation.Open_Up:    topState = 'up';   topPerc = 1; break;
      case this.mdriver.Operation.Stop:       topState = 'idle'; break;
    }
    if (msg.data.targetPosition_T != undefined) { // so if targetposition specified, overrule operation and current position
      topPerc = this.mdriver.positionToPercentageOpen(msg.data.targetPosition_T);
      topState = this.travelDirection(topPerc, this.getCapabilityValue('windowcoverings_set.top'), true); 
    } else if (msg.data.currentPosition_T != undefined) { // if currentposition received, overrule operation because then this is is not a state operation
      topPerc = this.mdriver.positionToPercentageOpen(msg.data.currentPosition_T);
      topState = this.travelDirection(topPerc, this.getCapabilityValue('windowcoverings_set.top'));
      if (topState != 'idle') { // this is a state report, not a state change, yet it is different from what we know, usually from remote. Signal the change, and force stop a little later.
        this.log('unexpected top state change', topState);
        scheduleStop = true;
      }
    }
    let bottomState = undefined;
    let bottomPerc = undefined;
    switch(msg.data.operation_B) { // beware! no difference between current and action! Do this first, because for write the others aren't there
      case this.mdriver.Operation.Close_Down: bottomState = 'down'; bottomPerc = 0; break;
      case this.mdriver.Operation.Open_Up:    bottomState = 'up';   bottomPerc = this.getCapabilityValue('windowcoverings_set.top'); break;
      case this.mdriver.Operation.Stop:       bottomState = 'idle'; break;
    }
    if (msg.data.targetPosition_B != undefined) { // so if targetposition specified, overrule operation and current position
      bottomPerc = this.mdriver.positionToPercentageOpen(msg.data.targetPosition_B);
      bottomState = this.travelDirection(bottomPerc, this.getCapabilityValue('windowcoverings_set.bottom'), true);
    } else if (msg.data.currentPosition_B != undefined) { // if currentposition received, overrule operation because then this is is not a state operation
      bottomPerc = this.mdriver.positionToPercentageOpen(msg.data.currentPosition_B);
      bottomState = this.travelDirection(bottomPerc, this.getCapabilityValue('windowcoverings_set.bottom'));
      if (bottomState != 'idle') { // this is a state report, not a state change, yet it is different from what we know, usually from remote. Signal the change, and force stop a little later.
        this.log('unexpected bottom state change', bottomState);
        scheduleStop = true;
      }
    }
    if (topState != undefined && this.hasCapability('windowcoverings_state.top'))
      await this.setCapabilityStateTop(topState, bottomState == 'idle');
    if (bottomState != undefined) {
      if (this.hasCapability('windowcoverings_state.bottom'))
        await this.setCapabilityStateBottom(bottomState);
        if (this.hasCapability('windowcoverings_state'))
          await this.setCapabilityState(bottomState);
    } else if (topState != undefined && this.hasCapability('windowcoverings_state'))
        await this.setCapabilityState(topState == 'up' ? 'down' : topState);
    if (bottomPerc != undefined && this.hasCapability('windowcoverings_set.bottom'))
      await this.setCapabilityPercentageTopBottom(topPerc, bottomPerc);
    if (scheduleStop)
      this.scheduleStop(); 
  }

  async setTiltState(msg) {
    let angle = undefined;
    if (msg.data.targetAngle != undefined)
      angle = this.mdriver.angleToPercentageTilt(msg.data.targetAngle, this.maxAngle);
    else if (msg.data.currentAngle != undefined)
      angle = this.mdriver.angleToPercentageTilt(msg.data.currentAngle, this.maxAngle);
    await this.setCapabilityTiltPercentage(angle);
  }

  async setStates(msg) {
    if (msg.data != undefined) {
      await this.setUpDownStates(msg);
      await this.setTopBottomStates(msg);
      await this.setTiltState(msg);
      if (msg.data.batteryLevel != undefined) 
        await this.setCapabilityBattery(this.mdriver.batteryLevelToPercentage(msg.data.batteryLevel));
      else if (msg.data.batteryLevel_T != undefined && msg.data.batteryLevel_B != undefined) // take the smaller
        await this.setCapabilityBatteryTopBottom(this.mdriver.batteryLevelToPercentage(msg.data.batteryLevel_T), 
                                                 this.mdriver.batteryLevelToPercentage(msg.data.batteryLevel_B));
      await this.setCapabilityRSSI(msg.data.RSSI);
    }
  }

  checkSettings(msg) {
    if (msg.data != undefined) {
      let save = false;
      let newSettings = {};
      let data = this.getData();
      let settings = this.getSettings();
      if (settings == undefined)
        settings = { };
      if (data.deviceType == this.mdriver.DeviceType.DoubleRoller)
        this.maxAngle = this.mdriver.Angle.DR_Close;
      if (settings.deviceTypeName == undefined || settings.deviceTypeName == '?') {
        newSettings.deviceTypeName = this.homey.app.getDeviceTypeName(data.deviceType);
        if (newSettings.deviceTypeName == null || newSettings.deviceTypeName == undefined || newSettings.deviceTypeName == '?')
          newSettings.deviceTypeName = '-';
        save = true;
      }
      if (msg.data.type != undefined) {
        this.checkTiltCapability(msg.data.type == this.mdriver.BlindType.VenetianBlind || 
                                 msg.data.type == this.mdriver.BlindType.ShangriLaBlind);
        if (msg.data.type == this.mdriver.BlindType.ShangriLaBlind)
          this.maxAngle = this.mdriver.Angle.DR_Close;                         
        if (msg.data.type != settings.type || settings.typeName == undefined || settings.typeName == '?') { 
            newSettings.type = msg.data.type; 
            newSettings.typeName = this.homey.app.getBlindTypeName(msg.data.type);
            if (newSettings.typeName == null || newSettings.typeName == undefined || newSettings.typeName == '?')
              newSettings.typeName = '-';
          save = true;
        } 
      }
      if (msg.data.voltageMode != undefined) {
        this.checkBatteryCapability(msg.data.voltageMode == this.mdriver.VoltageMode.DC, msg.data.type, settings.separateBatteryStates);
        if (msg.data.voltageMode != settings.voltageMode || settings.voltageModeName == undefined || settings.voltageModeName == '?') { 
          newSettings.voltageMode = msg.data.voltageMode; 
          newSettings.voltageModeName = this.homey.app.getVoltageModeName(msg.data.voltageMode);
          if (newSettings.voltageModeName == null || newSettings.voltageModeName == undefined ||  newSettings.voltageModeName == '?')
            newSettings.voltageModeName = '-';
        save = true; 
        }
      }
      if (msg.data.wirelessMode != undefined) {
        this.checkBidirectionalCapability(msg.data.wirelessMode == this.mdriver.WirelessMode.BiDirection || 
                                          msg.data.wirelessMode == this.mdriver.WirelessMode.BidirectionMech, msg.data.type); 
        if (msg.data.wirelessMode != settings.wirelessMode || settings.wirelessModeName == undefined || settings.wirelessModeName == '?') { 
          newSettings.wirelessMode = msg.data.wirelessMode; 
          newSettings.wirelessModeName = this.homey.app.getWirelessModeName(msg.data.wirelessMode);
          if (newSettings.wirelessModeName == null || newSettings.wirelessModeName == undefined || newSettings.wirelessModeName == '?')
            newSettings.wirelessModeName = '-';
          save = true; 
          }
      }
      if (save) {
        this.log('Save settings ', newSettings);
        this.setSettings(newSettings);
      } 
    }
  }

  async onReport(msg, info) {
    this.log('onReport');
    this.checkSettings(msg);
    this.setStates(msg);
    if (this.expectReportTimer != undefined) {  // got the report as expected, don't force read state by the timer
      clearTimeout(this.expectReportTimer);
      this.expectReportTimer = undefined;
    } else if (this.getSetting('inRemoteGroup')) { // if a report cones in unannounced, it is often due to a remote. Bad news is, if a remote is tied to several blinds, only one reports. So, if it is part of a group, poll them all
      this.log('unexpected Report triggered poll');
      this.mdriver.pollStates(true, true);
    }
  }

  async onReadDeviceAck(msg, info) {
    this.log('onReadDeviceAck');
    this.checkSettings(msg);
    this.setStates(msg);
  }

  async onWriteDevice(msg, info) {
    this.log('onWriteDevice');
    this.setStates(msg);
  }

  async onWriteDeviceAck(msg, info) {
    this.log('onWriteDeviceAck');
    // this.setStates(msg, false);  don't set 'old' state, wait for result of change
    this.checkSettings(msg);
  }
  
  async onHeartbeat(msg, info) {
    ++(this.heartbeatCount);
    if (this.heartbeatCountRefresh > 0 && (this.heartbeatCount % this.heartbeatCountRefresh) == 0) {
      this.log('onHeartbeat triggers statusQuery on count', this.heartbeatCount);
      this.heartbeatCount = 0;
      this.statusQuery();
    }
  }

  async readDevice() {
    let data = this.getData();
    this.mdriver.send({
			"msgType": 'ReadDevice',
			"mac": data.mac,
			"deviceType": data.deviceType,
			"accessToken": this.mdriver.getAccessTokenByID(data),
			"msgID": this.mdriver.getMessageID()
		});  
  }

  setReportTimeout() { // not always after a write the report is received. If not, then read explicitly
    if (this.expectReportTimer) 
      clearTimeout(this.expectReportTimer); // expect report later if commands follow up quickly
    let timeout = this.getSetting('maxTravelTime');
    if (timeout == null ||  timeout == undefined)
      timeout = 60;
    else if (timeout < 5)
      timeout = 5;
    this.expectReportTimer = setTimeout(function () {
      this.log('onReportTimeout', timeout);
      this.expectReportTimer = undefined;
      this.readDevice();
    }.bind(this), 1000 * timeout);
  }

  async writeDevice(newdata) {
    if (!this.mdriver.verbose) this.log('write', newdata);
    this.setReportTimeout(); 
    let data = this.getData();
    this.mdriver.send({
			"msgType": 'WriteDevice',
			"mac": data.mac,
			"deviceType": data.deviceType,
			"accessToken": this.mdriver.getAccessTokenByID(data),
			"msgID": this.mdriver.getMessageID(),
      "data": newdata
		});  
  }

  async setPercentageOpen(perc) {
    let pos = this.mdriver.percentageOpenToPosition(perc);
    if (pos != this.mdriver.Position.Open_Up && this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
      this.log('CloseDownBlocked');
      this.readDevice();
      this.triggerBlocked();
    } else {
      if (this.mdriver.verbose)
        this.log('setPosition', pos);
      switch (pos) {
        case this.mdriver.Position.Open_Up:    await this.setCapabilityState('up');   break;
        case this.mdriver.Position.Close_Down: await this.setCapabilityState('down'); break;    
        default: await this.setCapabilityState(this.travelDirection(perc, this.getCapabilityValue('windowcoverings_set'))); break;
      }
      this.setCapabilityPercentage(perc);
      this.writeDevice({ "targetPosition": pos });    
    }
  }

  async setPercentageOpenTopBottom(topPerc, bottomPerc, doState = true) {
    let topSet = topPerc != undefined;
    let bottomSet = bottomPerc != undefined;
    if (topPerc != undefined || bottomPerc != undefined) {
      if (topPerc == undefined) { // check positions, as to never force the top below the bottom bar
        topPerc = this.getCapabilityValue('windowcoverings_set.top');
        if (topPerc < bottomPerc) 
          if (this.getSetting('linkedBars'))
            topPerc = bottomPerc;
          else
            bottomPerc = topPerc;
      } else if (bottomPerc == undefined) {
        bottomPerc = this.getCapabilityValue('windowcoverings_set.bottom');
        if (topPerc < bottomPerc)
          if (this.getSetting('linkedBars'))
            bottomPerc = topPerc;
          else
            topPerc = bottomPerc;
      } else if (topPerc < bottomPerc) { // if set both bars, but with reversed positions, swap positions
          let t = topPerc;
          topPerc = bottomPerc;
          bottomPerc = t;
      }
      let topPos = this.mdriver.percentageOpenToPosition(topPerc);
      let bottomPos = this.mdriver.percentageOpenToPosition(bottomPerc);
      if ((topPos != this.mdriver.Position.Open_Up || bottomPos != this.mdriver.Position.Open_Up) && 
          this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
        this.log('PercentageOpenTopBottomBlocked');
        this.readDevice();
        this.triggerBlocked();
      } else {
        if (this.mdriver.verbose)
          this.log('setPositionTopBottom', topPos, bottomPos);
        switch (topPos) {
          case this.mdriver.Position.Open_Up:    if (topSet) { await this.setCapabilityStateTop('up', doState);   break; } // break inside if!
          case this.mdriver.Position.Close_Down: if (topSet) { await this.setCapabilityStateTop('down', doState); break; } // break inside if!
          default: await this.setCapabilityStateTop(this.travelDirection(topPerc, this.getCapabilityValue('windowcoverings_set.top')), doState); break;
        }
        switch (bottomPos) {
          case this.mdriver.Position.Open_Up:    if (bottomSet) { await this.setCapabilityStateBottom('up', doState);   break; } // break inside if!
          case this.mdriver.Position.Close_Down: if (bottomSet) { await this.setCapabilityStateBottom('down', doState); break; } // break inside if!
          default: await this.setCapabilityStateBottom(this.travelDirection(bottomPerc, this.getCapabilityValue('windowcoverings_set.bottom')), doState); break;
        }
        await this.setCapabilityPercentageTopBottom(topSet ? topPerc : undefined, bottomSet ? bottomPerc : undefined);
        this.writeDevice({ "targetPosition_T": topPos, "targetPosition_B": bottomPos });    
      }
    }
  }

  async setPercentageTilt(perc) {
    let pos = this.mdriver.percentageTiltToAngle(perc, this.maxAngle);
    if (this.mdriver.verbose)
      this.log('setAngle', pos);
    await this.setPercentageTilt(perc);
    this.writeDevice({ "targetAngle": pos });    
  }

  async openUp() {
    if (this.mdriver.verbose)
      this.log('OpenUp');
    await this.setCapabilityState('up');
    this.writeDevice({ "operation": this.mdriver.Operation.Open_Up });    
  }

  async closeDown() {
    if (this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
      this.log('CloseDownBlocked');
      if (this.hasCapability('windowcoverings_set'))
        this.readDevice();
      else
        this.scheduleStop();
      this.triggerBlocked();
    } else {
      if (this.mdriver.verbose)
        this.log('CloseDown');
      await this.setCapabilityState('down');
      this.writeDevice({ "operation": this.mdriver.Operation.Close_Down });    
    }
  }

  async stop() {
    if (this.mdriver.verbose)
      this.log('stop');
    await this.setCapabilityState('idle');
    this.writeDevice({ "operation": this.mdriver.Operation.Stop });    
  }

  async openUpTop() {
    if (this.mdriver.verbose)
      this.log('OpenUpTop');
    await this.setCapabilityStateTop('up');
    this.writeDevice({ "operation_T": this.mdriver.Operation.Open_Up });    
  }

  async closeDownTop() {
    if (this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
      this.log('closeDownTopBlocked');
      if (this.hasCapability('windowcoverings_set.top'))
        this.readDevice();
      else
        this.scheduleStop();
      this.triggerBlocked();
    } else {
      if (this.mdriver.verbose)
        this.log('CloseDownTop');
      if (this.getSetting('linkedBars') || !this.hasCapability('windowcoverings_set.bottom') || 
          this.getCapabilityValue('windowcoverings_set.bottom') < 0.05) {
          await this.setCapabilityStateTop('down');
          this.writeDevice({ "operation_T": this.mdriver.Operation.Close_Down, "operation_B": this.mdriver.Operation.Close_Down });    
      } else
        this.setPercentageOpenTopBottom(this.getCapabilityValue('windowcoverings_set.bottom'), undefined);
    }
  }

  async stopTop() {
    if (this.mdriver.verbose)
      this.log('stopTop');
    if (this.getCapabilityValue('windowcoverings_state.bottom') == 'up') {
      await this.setCapabilityStateTop('idle');
      await this.setCapabilityStateBottom('idle');
      this.writeDevice({ "operation_T": this.mdriver.Operation.Stop, "operation_B": this.mdriver.Operation.Stop });    
    } else {
      await this.setCapabilityStateTop('idle');
      this.writeDevice({ "operation_T": this.mdriver.Operation.Stop });    
    }
  }

  async openUpBottom() {
    if (this.mdriver.verbose)
      this.log('OpenUpBottom');
    if (this.getSetting('linkedBars') || !this.hasCapability('windowcoverings_set.top') ||
        this.getCapabilityValue('windowcoverings_set.top') > 0.95) {
      await this.setCapabilityStateBottom('up');
      this.writeDevice({ "operation_T": this.mdriver.Operation.Open_Up, "operation_B": this.mdriver.Operation.Open_Up });    
    } else 
      this.setPercentageOpenTopBottom(undefined, this.getCapabilityValue('windowcoverings_set.top'));
  }

  async closeDownBottom() {
    if (this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
      this.log('closeDownBottomBlocked');
      if (this.hasCapability('windowcoverings_set.bottom'))
        this.readDevice();
      else
        this.scheduleStop();
      this.triggerBlocked();
    } else {
      if (this.mdriver.verbose)
        this.log('CloseDownBottom');
      await this.setCapabilityStateBottom('down');
      this.writeDevice({ "operation_B": this.mdriver.Operation.Close_Down });    
    }
  }

  async stopBottom() {
    if (this.mdriver.verbose)
      this.log('stopBottom');
    if (this.getCapabilityValue('windowcoverings_state.top') == 'down') {
      await this.setCapabilityStateTop('idle');
      await this.setCapabilityStateBottom('idle');
      this.writeDevice({ "operation_T": this.mdriver.Operation.Stop, "operation_B": this.mdriver.Operation.Stop });    
    } else {
      await this.setCapabilityStateBottom('idle');
      this.writeDevice({ "operation_B": this.mdriver.Operation.Stop });    
    }
  }

  async stateTopBottom(topState, bottomState, doState = true) {
    if (topState == 'down' && bottomState == 'up') // no clashes allowed
      topState = bottomState = 'idle';
    if ((topState != 'idle' || bottomState != 'idle') && (topState != 'up' || bottomState != 'up') && 
          this.hasCapability('alarm_contact') && this.getCapabilityValue('alarm_contact')) {
      this.log('stateTopBottomBlocked');
      if (this.hasCapability('windowcoverings_set.top'))
        this.readDevice();
      else
        this.scheduleStop();
      this.triggerBlocked();
    } else {
      if (this.mdriver.verbose)
        this.log('stateTopBottom');
      let topOperation = undefined;
      switch (topState) {
        case 'up':   topOperation = this.mdriver.Operation.Open_Up;    break;
        case 'down': topOperation = this.mdriver.Operation.Close_Down; break;
        default:     topOperation = this.mdriver.Operation.Stop;       break;
      }
      let bottomOperation = undefined;
      switch (bottomState) {
        case 'up':   bottomOperation = this.mdriver.Operation.Open_Up;    break;
        case 'down': bottomOperation = this.mdriver.Operation.Close_Down; break;
        default:     bottomOperation = this.mdriver.Operation.Stop;       break;
      }
      await this.setCapabilityStateTop(topState, doState);
      await this.setCapabilityStateBottom(bottomState, doState);
      this.writeDevice({ "operation_T": topOperation, "operation_B": bottomOperation });    
    }
  }

  async statusQuery() {
    this.log('statusQuery');
    if (this.hasCapability('windowcoverings_set.top') && this.hasCapability('windowcoverings_set.bottom')) {
      this.readDevice();
      this.writeDevice({ "operation_T": this.mdriver.Operation.StatusQuery,   // does not seem to work for TDBU
                         "operation_B": this.mdriver.Operation.StatusQuery }); 
    } else
      this.writeDevice({ "operation": this.mdriver.Operation.StatusQuery });    
  }
}

module.exports = MotionDeviceGeneric;
