# ams-102
CCV work with AMS

Edit the files.json file in the python directory to be some files you 
want to look at, and try this:

```
$ cd python
$ pvpython AMSServer.py -i localhost -p 1234 --dataConfigFile files.json
```

Over on the client, try this:

```
$ cd js
$ npm install
$ npm run build
$ npm start
```

Then go to a browser and open localhost:8080
