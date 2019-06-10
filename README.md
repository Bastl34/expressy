# Expressy
Expressy is a simple node express based websever and proxy.


## Howto
* copy `config.json.dist` to `config.json` and apply your server settings


## Types
### static
```
{
    "domain": "testtest1.com",
    "type": "static",
    "source": "./test"
},
```

### proxy
```
{
    "domain": "testtest2.com",
    "type": "proxy",
    "source": "127.0.0.1:8080"
},
```