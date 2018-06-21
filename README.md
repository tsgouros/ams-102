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


** As of Paraview 5.5.2, the following fix (to Paraview) is necessary
   to get the two views to work smoothly with one another:
   
```
 diff .../ParaView-5.5.2.app/Contents/Python/paraview/web/protocols.py~ /Applications/ParaView-5.5.2.app/Contents/Python/paraview/web/protocols.py
605,606c605,606
<             startCallback = lambda *args, **kwargs: self.startViewAnimation()
<             stopCallback = lambda *args, **kwargs: self.stopViewAnimation()
---
>             startCallback = lambda *args, **kwargs: self.startViewAnimation(realViewId)
>             stopCallback = lambda *args, **kwargs: self.stopViewAnimation(realViewId)
```
