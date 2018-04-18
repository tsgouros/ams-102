r"""This module is a ParaViewWeb server application.
    The following command line illustrates how to use it::
        $ pvpython -dr AmsPVServer.py --data-dir /.../path-to-your-data-directory

        --data
             Path used to list that directory on the server and let
             the client choose a file to load.  You may also specify
             multiple directories, each with a name that should be
             displayed as the top-level name of the directory in the
             UI.  If this parameter takes the form:
             "name1=path1|name2=path2|...", then we will treat this as
             the case where multiple data directories are required.
             In this case, each top-level directory will be given the
             name associated with the directory in the argument.

        --load-file try to load the file relative to data-dir if any.

        --ds-host None
             Host name where AmsPVServer has been started

        --ds-port 11111
              Port number to use to connect to AmsPVServer

        --rs-host None
              Host name where renderserver has been started

        --rs-port 22222
              Port number to use to connect to the renderserver

        --exclude-regex "[0-9]+\\."
              Regular expression used to filter out files in directory/file listing.
        --group-regex "^\\.|~$|^\\$"
              Regular expression used to group files into a single loadable entity.

        --color-palette-file
            File to load to define a set of color maps.  File format is the same as
            for ParaViews 'ColorMaps.xml' configuration file.

    Any ParaViewWeb executable script comes with a set of standard arguments
    that can be overriden if need be::
        --port 8080
             Port number on which the HTTP server will listen.
        --content /path-to-web-content/
             Directory that you want to serve as static web content.
             By default, this variable is empty which means that we rely on another
             server to deliver the static content and the current process only
             focuses on the WebSocket connectivity of clients.
        --authKey wslink-secret
             Secret key that should be provided by the client to allow it to make
             any WebSocket communication. The client will assume if none is given
             that the server expects "wslink-secret" as the secret key.

"""

# import to process args
import os
import sys

# Try to handle virtual env if provided
if '--virtual-env' in sys.argv:
  virtualEnvPath = sys.argv[sys.argv.index('--virtual-env') + 1]
  virtualEnv = os.path.join(virtualEnvPath, 'bin', 'activate_this.py')
  execfile(virtualEnv, dict(__file__=virtualEnv))

# import paraview modules.
from paraview.web import pv_wslink
from paraview.web import protocols as pv_protocols

import AMSProtocols

# import RPC annotation
from wslink import register as exportRPC

from paraview import simple
from wslink import server

import json

try:
    import argparse
except ImportError:
    # since  Python 2.6 and earlier don't have argparse, we simply provide
    # the source for the same as _argparse and we use it instead.
    from vtk.util import _argparse as argparse

# =============================================================================
# Create custom Pipeline Manager class to handle clients requests
# =============================================================================

class AMSServer(pv_wslink.PVServerProtocol):

    dataDir = os.getcwd()
    dataConfig = ""
    authKey = "wslink-secret"
    dsHost = None
    dsPort = 11111
    rsHost = None
    rsPort = 11111
    rcPort = -1
    fileToLoad = None
    groupRegex = "[0-9]+\\."
    excludeRegex = "^\\.|~$|^\\$"
    plugins = None
    filterFile = None
    colorPalette = None
    proxies = None
    allReaders = True
    saveDataDir = os.getcwd()
    viewportScale=1.0
    viewportMaxWidth=2560
    viewportMaxHeight=1440
    config = {
        "profiles": {
            "default": {
                "modules_included": [],
                "modules_excluded": [],
                "viewType": 1,
            },
            "secondary": {
                "modules_included": [],
                "modules_excluded": [],
                "viewType": 2,
            },
        },
    }


    @staticmethod
    def add_arguments(parser):
        parser.add_argument("--dataConfigFile", default=None, help="Path to a data config file")  

        parser.add_argument("--virtual-env", default=None, help="Path to virtual environment to use")
        parser.add_argument("--dataDir", default=os.getcwd(), help="path to data directory to list", dest="data")
        parser.add_argument("--config", help="path to config file", dest="configFile")
        parser.add_argument("--profile", default="default", help="name of profile to use", dest="profile")
        parser.add_argument("--viewport-scale", default=1.0, type=float, help="Viewport scaling factor", dest="viewportScale")
        parser.add_argument("--viewport-max-width", default=2560, type=int, help="Viewport maximum size in width", dest="viewportMaxWidth")
        parser.add_argument("--viewport-max-height", default=1440, type=int, help="Viewport maximum size in height", dest="viewportMaxHeight")
        parser.add_argument("--settings-lod-threshold", default=102400, type=int, help="LOD Threshold in Megabytes", dest="settingsLODThreshold")

    @staticmethod
    def configure(args):
        AMSServer.authKey   = args.authKey
        AMSServer.data      = args.data
        if args.configFile and os.path.exists(args.configFile):
            with open(args.configFile) as fp:
                AMSServer.config = json.load(fp)

        if args.dataConfigFile and os.path.exists(args.dataConfigFile):
            with open(args.dataConfigFile) as fp:
                AMSServer.dataConfig = json.load(fp)

        AMSServer.profile = args.profile
        AMSServer.viewportScale     = args.viewportScale
        AMSServer.viewportMaxWidth  = args.viewportMaxWidth
        AMSServer.viewportMaxHeight = args.viewportMaxHeight
        AMSServer.settingsLODThreshold = args.settingsLODThreshold


    def initialize(self):

        # Bring used components
#        self.registerVtkWebProtocol(pv_protocols.ParaViewWebFileListing(AMSServer.data, "Home", AMSServer.excludeRegex, AMSServer.groupRegex))
#        self.registerVtkWebProtocol(pv_protocols.ParaViewWebColorManager())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebMouseHandler())
#        self.registerVtkWebProtocol(pv_protocols.ParaViewWebTimeHandler())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPort(AMSServer.viewportScale, AMSServer.viewportMaxWidth, AMSServer.viewportMaxHeight))
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebPublishImageDelivery(decode=False))
#        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPortImageDelivery())
#        self.registerVtkWebProtocol(pv_protocols.ParaViewPublishImageDelivery())

        amstest = AMSProtocols.AMSTest(AMSServer.config, AMSServer.profile)

        ## Register the AMS components
        self.registerVtkWebProtocol(amstest)

        # Update authentication key to use
        self.updateSecret(AMSServer.authKey)

        # tell the C++ web app to use no
        # encoding. ParaViewWebPublishImageDelivery must be set to
        # decode=False to match.
        self.getApplication().SetImageEncoding(0);

        # Disable interactor-based render calls
        simple.GetRenderView().EnableRenderOnInteraction = 0
        simple.GetRenderView().Background = [0,0,0]
        simple.GetRenderView().Background2 = [0,0,0]

        if self.dataConfig:
            amstest.initializeData( self.dataConfig["files"] )
        else:
            amstest.initializeData( ["/Users/tomfool/tech/18/amgen/ams-102-AgileViz/EnSight/mat-viz-mofTFF-90L-9.1lpm-100rpm/mat-viz-mofTFF-90L-9.1lpm-100rpm.case", "/Users/tomfool/tech/18/amgen/ams-102-AgileViz/EnSight/mat-viz-mofTFF-90L-9.1lpm-250rpm/mat-viz-mofTFF-90L-9.1lpm-250rpm.case" ])

         # Update interaction mode
        pxm = simple.servermanager.ProxyManager()
        interactionProxy = pxm.GetProxy('settings',
                                        'RenderViewInteractionSettings')
        interactionProxy.Camera3DManipulators = ['Rotate',
                                                 'Pan',
                                                 'Zoom',
                                                 'Pan',
                                                 'Roll',
                                                 'Pan',
                                                 'Zoom',
                                                 'Rotate',
                                                 'Zoom']

        # Custom rendering settings
        renderingSettings = pxm.GetProxy('settings', 'RenderViewSettings')
        renderingSettings.LODThreshold = AMSServer.settingsLODThreshold

# =============================================================================
# Main: Parse args and start server
# =============================================================================

if __name__ == "__main__":
    # Create argument parser
    parser = argparse.ArgumentParser(description="AMS")

    # Add arguments
    server.add_arguments(parser)
    AMSServer.add_arguments(parser)
    args = parser.parse_args()
    AMSServer.configure(args)

    args.fsEndpoints = 'ds=' + args.data

    # Start server
    server.start_webserver(options=args, protocol=AMSServer)
