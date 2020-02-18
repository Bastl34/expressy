# Expressy
Expressy is a simple node-express based static webserver and proxy.

![Expressy Logo](./docs/logo.png)

## Howto
* copy `config.json.dist` to `config.json` and apply your server settings
* `npm i`
* use forever, forver-service or whatever to let the server run forever


## Commands

```bash
#start
npm run start

#validate config
npm run validate
```


## Types
### static
```json
{
    "domain": "testtest1.com",
    "type": "static",
    "index": false,
    "target": "./test",
    "filter": ["**.php"]
}
```

* if you want to enable directory listings: enable `index`

### proxy
```json
{
    "domain": "testtest2.com",
    "type": "proxy",
    "target": "127.0.0.1:8080"
}
```

### alias
```json
{
    "domain": "testtest3.com",
    "type": "alias",
    "target": "testtest2.com"
}
```

### redirect
```json
{
    "domain": "testtest4.com",
    "type": "redirect",
    "target": "https://google.com"
}
```

### basic auth
```json
{
    "domain": "testtest4.com",
    "type": "redirect",
    "target": "https://google.com",
	"basicAuth": { "user": "user", "password": "password", "title": "protected area" }
}
```

## Wildcards
* wildcard support is done via micromatch
  * https://github.com/micromatch/micromatch

## Filters
* Filtered files are not served
* all `.` files and `.` directories are filterd by default
* You can define filters for `"type": "static"`
* If you want to filter all php files in all directories:
  * `"filter": ["**.php"]`
* Its based on micromatch:
  * https://github.com/micromatch/micromatch

## run with forever service
```bash
#install dependencies
sudo npm install -g forever
sudo npm install -g forever-service

#add new service
cd expressy
sudo forever-service install expressy --script index.js --noGracefulShutdown --start

#if you want to uninstall the service
sudo forever-service delete expressy
```
