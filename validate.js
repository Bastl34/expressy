const fs = require('fs');

try
{
    const config = JSON.parse(fs.readFileSync('./config.json'));
    console.log("config is valid ✅")
}
catch(error)
{
    console.error(error);
    console.log("config is not valid ❌")
}