var rpio = require('rpio');
const dhtSensor = require('node-dht-sensor');
const http = require('http');
let Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-heater-thermostat', 'HeaterThermostat', Thermostat);
};

class Thermostat {
  constructor(log, config) {
    this.log = log;
    this.name = config.name;
    this.maxTemperature = config.maxTemperature || 28;
    this.minTemperature = config.minTemperature || 12;
    this.relayPin = config.relayPin || 21;
    this.dhtSensorType = config.dhtSensorType || 22;
    this.invert = config.invert || false;
    this.temperatureThreshold = config.temperatureThreshold || 0.5;
    this.temperatureSensorPin = config.temperatureSensorPin || 4;
    this.minimumOnOffTime = config.minimumOnOffTime || 120000; // In milliseconds
    this.temperatureCheckInterval = config.temperatureCheckInterval || 10000; // In milliseconds

    rpio.open(this.relayPin, rpio.OUTPUT, this.gpioVal(false));

    this.currentTemperature = 21;
    this.currentRelativeHumidity = 50;
    this.targetTemperature = 23;

    this.heatingThresholdTemperature = 18;
    this.coolingThresholdTemperature = 24;

    //Characteristic.TemperatureDisplayUnits.CELSIUS = 0;
    //Characteristic.TemperatureDisplayUnits.FAHRENHEIT = 1;
    this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;

    // The value property of CurrentHeatingCoolingState must be one of the following:
    //Characteristic.CurrentHeatingCoolingState.OFF = 0;
    //Characteristic.CurrentHeatingCoolingState.HEAT = 1;
    this.currentHeatingCoolingState = this.readState()
      ? Characteristic.CurrentHeatingCoolingState.HEAT
      : Characteristic.CurrentHeatingCoolingState.OFF;

    // The value property of TargetHeatingCoolingState must be one of the following:
    //Characteristic.TargetHeatingCoolingState.OFF = 0;
    //Characteristic.TargetHeatingCoolingState.HEAT = 1;
    this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;

    this.thermostatService = new Service.Thermostat(this.name);

    this.readTemperatureFromSensor();
    setInterval(() => this.readTemperatureFromSensor(), this.temperatureCheckInterval);
  }

  get currentlyRunning() {
    return this.systemStateName(this.currentHeatingCoolingState);
  }

  get shouldTurnOnHeating() {
    return this.currentTemperature < (this.targetTemperature - this.temperatureThreshold);
  }

  get shouldTurnOffHeating() {
    return this.currentTemperature > (this.targetTemperature + this.temperatureThreshold);
  }

  gpioVal(val) {
    if (this.invert) val = !val;
    return val ? rpio.HIGH : rpio.LOW;
  }

  setState = function (val) {
    rpio.write(this.relayPin, this.gpioVal(val));
    this.log("GPIO State changed to: ", val);
    this.lastCurrentHeatingCoolingStateChangeTime = new Date();
  }

  readState = function () {
      var value = rpio.read(this.relayPin) > 0;
      this.log("GPIO State read as: ", value);
	  var val = this.gpioVal(value);
	  return val == rpio.HIGH;
  }

  identify(callback) {
    this.log('Identify requested!');
    callback(null);
  }

  systemStateName(heatingCoolingState) {
    if (heatingCoolingState === Characteristic.CurrentHeatingCoolingState.HEAT) {
      return 'Heat';
    } else if (heatingCoolingState === Characteristic.CurrentHeatingCoolingState.COOL) {
      return 'Cool';
    } else {
      return 'Off';
    }
  }

  turnOnSystem(systemToTurnOn) {
    if (this.currentHeatingCoolingState === Characteristic.CurrentHeatingCoolingState.OFF) {
      this.log(`START ${this.systemStateName(systemToTurnOn)}`);
      this.setState(true);
      this.currentHeatingCoolingState = systemToTurnOn;
      this.thermostatService.setCharacteristic(Characteristic.CurrentHeatingCoolingState, systemToTurnOn);
    } else if (this.currentHeatingCoolingState !== systemToTurnOn) {
      this.turnOffSystem();
    }
  }

  get timeSinceLastHeatingCoolingStateChange() {
    return new Date() - this.lastCurrentHeatingCoolingStateChangeTime;
  }

  turnOffSystem() {
    this.log("currentHeatingCoolingState is OFF")
    this.setState(false);
    this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
    this.thermostatService.setCharacteristic(Characteristic.CurrentHeatingCoolingState, this.currentHeatingCoolingState);
  }

  updateSystem(bypass) {
    if (!bypass && this.timeSinceLastHeatingCoolingStateChange < this.minimumOnOffTime) {
      const waitTime = this.minimumOnOffTime - this.timeSinceLastHeatingCoolingStateChange;
      this.log(`INFO Need to wait ${waitTime / 1000} second(s) before state changes.`);
      return;
    }

    if (this.currentHeatingCoolingState === Characteristic.CurrentHeatingCoolingState.HEAT)
    {
      if (this.shouldTurnOffHeating)
      {
        this.log("Current heating state: HEAT, should turnoff: ", this.shouldTurnOffHeating);
        this.turnOffSystem();
      }
      return;
    }
    if (this.currentHeatingCoolingState === Characteristic.CurrentHeatingCoolingState.OFF)
    {
      if (this.shouldTurnOnHeating)
      {
        this.log("Current heating state: OFF, should turnon: ", this.shouldTurnOnHeating);
        this.turnOnSystem(Characteristic.CurrentHeatingCoolingState.HEAT);
      }
      return;
    }
  }

  readTemperatureFromSensor() {
	  let date_ob = new Date();
	  url = "http://192.168.1.60/temperature?time=" + date_ob.getHours() + ":" + date_ob.getMinutes();
    dhtSensor.read(this.dhtSensorType, this.temperatureSensorPin, (err, temperature, humidity) => {
      if (!err) {
        this.currentTemperature = Math.round(temperature*10)/10;
        this.log.debug("CurrentTemperature: ", this.currentTemperature);
        this.currentRelativeHumidity = humidity;
        this.thermostatService.setCharacteristic(Characteristic.CurrentTemperature, this.currentTemperature);
        this.thermostatService.setCharacteristic(Characteristic.CurrentRelativeHumidity, this.currentRelativeHumidity);
      } else {
        this.log('ERROR Getting temperature');
      }
    });
  }
	
  getServices() {
    const informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Encore Dev Labs')
      .setCharacteristic(Characteristic.Model, 'Pi Thermostat')
      .setCharacteristic(Characteristic.SerialNumber, 'Raspberry Pi 3');

    // Off, Heat, Cool
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', callback => {
        this.log.debug('CurrentHeatingCoolingState:', this.currentHeatingCoolingState);
        callback(null, this.currentHeatingCoolingState);
      })
      .on('set', (value, callback) => {
        this.log.debug('SET CurrentHeatingCoolingState from', this.currentHeatingCoolingState, 'to', value);
        this.currentHeatingCoolingState = value;
        callback(null);
      });

    // Off, Heat
    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .setProps({
        maxValue: Characteristic.TargetHeatingCoolingState.HEAT
      })
      .on('get', callback => {
        this.log.debug('TargetHeatingCoolingState:', this.targetHeatingCoolingState);
        callback(null, this.targetHeatingCoolingState);
      })
      .on('set', (value, callback) => {
        this.log.debug('SET TargetHeatingCoolingState from', this.targetHeatingCoolingState, 'to', value);
        this.targetHeatingCoolingState = value;
        this.updateSystem(true);
        callback(null);
      });

    // Current Temperature
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({
        minStep: 0.1
      })
      .on('get', callback => {
        this.log.debug('CurrentTemperature:', this.currentTemperature);
        callback(null, this.currentTemperature);
      })
      .on('set', (value, callback) => {
        this.log.debug('SET CurrentTemperature from', this.currentTemperature, 'to', value);
        this.updateSystem();
        callback(null);
      });

    // Current humidity
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on('get', callback => {
        this.log.debug('CurrentRelativeHumidity:', this.currentRelativeHumidity);
        callback(null, this.currentRelativeHumidity);
      });

    // Target Temperature
    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .setProps({
        minValue: this.minTemperature,
        maxValue: this.maxTemperature,
        minStep: 0.1
      })
      .on('get', callback => {
        this.log.debug('TargetTemperature:', this.targetTemperature);
        callback(null, this.targetTemperature);
      })
      .on('set', (value, callback) => {
        this.log.debug('SET TargetTemperature from', this.targetTemperature, 'to', value);
        this.targetTemperature = value;
        this.updateSystem(true);
        callback(null);
      });

    // °C or °F for units
    this.thermostatService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', callback => {
        this.log.debug('TemperatureDisplayUnits:', this.temperatureDisplayUnits);
        callback(null, this.temperatureDisplayUnits);
      })
      .on('set', (value, callback) => {
        this.log.debug('SET TemperatureDisplayUnits from', this.temperatureDisplayUnits, 'to', value);
        this.temperatureDisplayUnits = value;
        callback(null);
      });

    // Auto max temperature
    this.thermostatService
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: this.minTemperature,
        maxValue: this.maxTemperature,
        minStep: 0.1
      })
      .on('get', callback => {
        this.log.debug('CoolingThresholdTemperature:', this.coolingThresholdTemperature);
        callback(null, this.coolingThresholdTemperature);
      })
      .on('set', (value, callback) => {
        this.log.debug('SET CoolingThresholdTemperature from', this.coolingThresholdTemperature, 'to', value);
        this.coolingThresholdTemperature = value;
        callback(null);
      });

    // Auto min temperature
    this.thermostatService
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: this.minTemperature,
        maxValue: this.maxTemperature,
        minStep: 0.1
      })
      .on('get', callback => {
        this.log.debug('HeatingThresholdTemperature:', this.heatingThresholdTemperature);
        callback(null, this.heatingThresholdTemperature);
      })
      .on('set', (value, callback) => {
        this.log.debug('SET HeatingThresholdTemperature from', this.heatingThresholdTemperature, 'to', value);
        this.heatingThresholdTemperature = value;
        callback(null);
      });

    this.thermostatService
      .getCharacteristic(Characteristic.Name)
      .on('get', callback => {
        callback(null, this.name);
      });

    return [informationService, this.thermostatService];//, this.fanService];
  }
}
