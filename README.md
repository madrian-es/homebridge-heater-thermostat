# Homebridge Pi Thermostat Plugin

This is a [homebridge](https://github.com/nfarina/homebridge) plugin to make a Raspberry Pi connected with a Relay Board and DHT22 Temperature and Humidity Sensor into a smart thermostat that can be controlled via the Home app on iOS using Homekit. This plugin only supports Heaters.

<a href="https://www.npmjs.com/package/homebridge-heater-thermostat">![](https://img.shields.io/npm/v/homebridge-heater-thermostat)</a>


### Installation

- You can use homebridge UI to install and configure this plugin.
- To install manually: `npm i homebridge-heater-thermostat`

### Configuration:

```

    {
      "accessory": "HeaterThermostat",
      "name": "Pi Thermostat",

      "relayPin": 21,
      "dhtSensorType": 22,
      "temperatureSensorPin": 4,

      "invert": false,
      "temperatureThreshold": 0.5,
      "maxTemperature": 28,
      "minTemperature": 12,
      "minimumOnOffTime": 120000, 
      "temperatureCheckInterval": 10000
    }
```

### Screenshot

<img src="IMG_0753.PNG" width="375" />
