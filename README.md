# Expressy
Expressy is a simple node express based static webserver and proxy.

![Expressy Logo](./assets/logo.png)

## Howto
* copy `config.json.dist` to `config.json` and apply your server settings
* `npm i`
* use forever, forver-service or whatever to let the server run forever


## Types
### static
```
{
    "domain": "testtest1.com",
    "type": "static",
    "source": "./test"
}
```

### proxy
```
{
    "domain": "testtest2.com",
    "type": "proxy",
    "source": "127.0.0.1:8080"
}
```

### alias
```
{
    "domain": "testtest3.com",
    "type": "alias",
    "source": "testtest2.com"
}
```

## run with forever service
```
#isntall dependencies
sudo npm install -g forever
sudo npm install -g forever-service

#add new service
cd expressy
sudo forever-service install expressy --script index.js --noGracefulShutdown --start

#if you want to uninstall the service
sudo forever-service delete expressy
```
