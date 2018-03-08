import os, sys, logging, types, inspect, traceback, logging, re, json, base64
from time import time

# import RPC annotation
from wslink import register as exportRPC

# import paraview modules.
import paraview

from paraview import simple, servermanager
from paraview.web import protocols as pv_protocols

# Needed for:
#    vtkSMPVRepresentationProxy
#    vtkSMTransferFunctionProxy
#    vtkSMTransferFunctionManager
from vtk.vtkPVServerManagerRendering import vtkSMPVRepresentationProxy, vtkSMTransferFunctionProxy, vtkSMTransferFunctionManager

# Needed for:
#    vtkSMProxyManager
from vtk.vtkPVServerManagerCore import vtkSMProxyManager

# Needed for:
#    vtkDataObject
from vtk.vtkCommonDataModel import vtkDataObject

# =============================================================================
#
# Viewport Size
#
# =============================================================================

# class AMSViewportSize(pv_protocols.ParaViewWebProtocol):

#     # RpcName: mouseInteraction => viewport.mouse.interaction
#     @exportRpc("light.viz.viewport.size")
#     def updateSize(self, viewId, width, height):
#         view = self.getView(viewId)
#         view.ViewSize = [ width, height ]

# =============================================================================
#
# Configuration management
#
# =============================================================================

class AMSConfig(pv_protocols.ParaViewWebProtocol):
    def __init__(self, config, defaultProfile):
        self.config = config
        self.defaultProfile = defaultProfile

    @exportRPC("amsprotocol.configuration.get")
    def getDefaultProfile(self):
        return [self.config, self.defaultProfile]

# =============================================================================

def simpleColorBy(rep=None, value=None):
    """Set scalar color. This will automatically setup the color maps and others
    necessary state for the representations. 'rep' must be the display
    properties proxy i.e. the value returned by GetDisplayProperties() function.
    If none is provided the display properties for the active source will be
    used, if possible."""
    rep = rep if rep else simple.GetDisplayProperties()
    if not rep:
        raise ValueError ("No display properties can be determined.")

    association = rep.ColorArrayName.GetAssociation()
    arrayname = rep.ColorArrayName.GetArrayName()
    component = None
    if value == None:
        rep.SetScalarColoring(None, servermanager.GetAssociationFromString(association))
        return
    if not isinstance(value, tuple) and not isinstance(value, list):
        value = (value,)
    if len(value) == 1:
        arrayname = value[0]
    elif len(value) >= 2:
        association = value[0]
        arrayname = value[1]
    if len(value) == 3:
        # component name provided
        componentName = value[2]
        if componentName == "Magnitude":
          component = -1
        else:
          if association == "POINTS":
            array = rep.Input.PointData.GetArray(arrayname)
          if association == "CELLS":
            array = rep.Input.CellData.GetArray(arrayname)
          if array:
            # looking for corresponding component name
            for i in range(0, array.GetNumberOfComponents()):
              if componentName == array.GetComponentName(i):
                component = i
                break
              # none have been found, try to use the name as an int
              if i ==  array.GetNumberOfComponents() - 1:
                try:
                  component = int(componentName)
                except ValueError:
                  pass
    if component is None:
      rep.SetScalarColoring(arrayname, servermanager.GetAssociationFromString(association))
    else:
      rep.SetScalarColoring(arrayname, servermanager.GetAssociationFromString(association), component)
    # rep.RescaleTransferFunctionToDataRange()


# =============================================================================
#
# Dataset management
#
# =============================================================================

class AMSDataObject(object):
    def __init__(self, fileName, renderView):

        self.name = fileName
        self.dataFile = simple.EnSightReader(CaseFileName=fileName)
        self.dataFile.PointArrays = ['pressure', 'pressure_coefficient', 'dynamic_pressure', 'absolute_pressure', 'total_pressure', 'rel_total_pressure', 'density', 'density_all', 'velocity_magnitude', 'x_velocity', 'y_velocity', 'z_velocity', 'axial_velocity', 'radial_velocity', 'tangential_velocity', 'rel_velocity_magnitude', 'relative_x_velocity', 'relative_y_velocity', 'relative_z_velocity', 'rel_tangential_velocity', 'mesh_x_velocity', 'mesh_y_velocity', 'mesh_z_velocity', 'velocity_angle', 'relative_velocity_angle', 'vorticity_mag', 'helicity', 'x_vorticity', 'y_vorticity', 'z_vorticity', 'cell_reynolds_number', 'turb_kinetic_energy', 'turb_intensity', 'turb_diss_rate', 'production_of_k', 'viscosity_turb', 'viscosity_eff', 'viscosity_ratio', 'y_star', 'y_plus', 'uds_0_scalar', 'uds_0_diff_scalar', 'viscosity_lam', 'wall_shear', 'x_wall_shear', 'y_wall_shear', 'z_wall_shear', 'skin_friction_coef', 'cell_partition_active', 'cell_partition_stored', 'cell_id', 'cell_element_type', 'cell_type', 'cell_zone', 'partition_neighbors', 'cell_weight', 'x_coordinate', 'y_coordinate', 'z_coordinate', 'axial_coordinate', 'angular_coordinate', 'abs_angular_coordinate', 'radial_coordinate', 'face_area_magnitude', 'x_face_area', 'y_face_area', 'z_face_area', 'cell_volume', 'orthogonal_quality', 'cell_equiangle_skew', 'cell_equivolume_skew', 'face_handedness', 'mark_poor_elememts', 'interface_overlap_fraction', 'cell_wall_distance', 'adaption_function', 'adaption_curvature', 'adaption_space_gradient', 'adaption_iso_value', 'boundary_cell_dist', 'boundary_normal_dist', 'cell_volume_change', 'cell_surface_area', 'cell_warp', 'cell_children', 'cell_refine_level', 'mass_imbalance', 'strain_rate_mag', 'dx_velocity_dx', 'dy_velocity_dx', 'dz_velocity_dx', 'dx_velocity_dy', 'dy_velocity_dy', 'dz_velocity_dy', 'dx_velocity_dz', 'dy_velocity_dz', 'dz_velocity_dz', 'dp_dx', 'dp_dy', 'dp_dz', 'velocity']

        self.renderView = renderView
        self.tankGeometryShown = False
        self.tankGeometryInit = False

        # get color transfer function/color map for 'pressure'
        pressureLUT = simple.GetColorTransferFunction('pressure')

        # get opacity transfer function/opacity map for 'pressure'
        pressurePWF = simple.GetOpacityTransferFunction('pressure')

        # create a new 'Contour'
        self.contour1 = simple.Contour(Input=self.dataFile)
        self.contour1.ContourBy = ['POINTS', 'pressure']
        self.contour1.Isosurfaces = [-3.9317703247070312]
        self.contour1.PointMergeMethod = 'Uniform Binning'

        # Properties modified on contour1
        self.contour1.ContourBy = ['POINTS', 'uds_0_scalar']
        self.contour1.Isosurfaces = [480.0, 570.0]

        # show data in view
        self.contour1Display = simple.Show(self.contour1, self.renderView)

        # trace defaults for the display properties.
        self.contour1Display.Representation = 'Surface'
        self.contour1Display.ColorArrayName = ['POINTS', 'pressure']
        self.contour1Display.LookupTable = pressureLUT
        self.contour1Display.OSPRayScaleArray = 'Normals'
        self.contour1Display.OSPRayScaleFunction = 'PiecewiseFunction'
        self.contour1Display.SelectOrientationVectors = 'velocity'
        self.contour1Display.ScaleFactor = 0.07228952534496784
        self.contour1Display.SelectScaleArray = 'None'
        self.contour1Display.GlyphType = 'Arrow'
        self.contour1Display.GlyphTableIndexArray = 'None'
        self.contour1Display.GaussianRadius = 0.03614476267248392
        self.contour1Display.SetScaleArray = ['POINTS', 'Normals']
        self.contour1Display.ScaleTransferFunction = 'PiecewiseFunction'
        self.contour1Display.OpacityArray = ['POINTS', 'Normals']
        self.contour1Display.OpacityTransferFunction = 'PiecewiseFunction'
        self.contour1Display.DataAxesGrid = 'GridAxesRepresentation'
        self.contour1Display.SelectionCellLabelFontFile = ''
        self.contour1Display.SelectionPointLabelFontFile = ''
        self.contour1Display.PolarAxes = 'PolarAxesRepresentation'

        # init the 'PiecewiseFunction' selected for 'ScaleTransferFunction'
        self.contour1Display.ScaleTransferFunction.Points = [-0.9995924830436707, 0.0, 0.5, 0.0, 0.9998393058776855, 1.0, 0.5, 0.0]

        # init the 'PiecewiseFunction' selected for 'OpacityTransferFunction'
        self.contour1Display.OpacityTransferFunction.Points = [-0.9995924830436707, 0.0, 0.5, 0.0, 0.9998393058776855, 1.0, 0.5, 0.0]

        # init the 'GridAxesRepresentation' selected for 'DataAxesGrid'
        self.contour1Display.DataAxesGrid.XTitleFontFile = ''
        self.contour1Display.DataAxesGrid.YTitleFontFile = ''
        self.contour1Display.DataAxesGrid.ZTitleFontFile = ''
        self.contour1Display.DataAxesGrid.XLabelFontFile = ''
        self.contour1Display.DataAxesGrid.YLabelFontFile = ''
        self.contour1Display.DataAxesGrid.ZLabelFontFile = ''

        # init the 'PolarAxesRepresentation' selected for 'PolarAxes'
        self.contour1Display.PolarAxes.PolarAxisTitleFontFile = ''
        self.contour1Display.PolarAxes.PolarAxisLabelFontFile = ''
        self.contour1Display.PolarAxes.LastRadialAxisTextFontFile = ''
        self.contour1Display.PolarAxes.SecondaryRadialAxesTextFontFile = ''

        # reset view to fit data
        self.renderView.ResetCamera()

        # hide data in view
        simple.Hide(self.dataFile, self.renderView)

        # show color bar/color legend
        self.contour1Display.SetScalarBarVisibility(self.renderView, True)

        # update the view to ensure updated data information
        self.renderView.Update()

        # set scalar coloring
        simple.ColorBy(self.contour1Display, ('POINTS', 'velocity_magnitude'))

        # rescale color and/or opacity maps used to include current data range
        self.contour1Display.RescaleTransferFunctionToDataRange(True, False)

        # show color bar/color legend
        self.contour1Display.SetScalarBarVisibility(self.renderView, True)

        # get color transfer function/color map for 'velocity_magnitude'
        velocity_magnitudeLUT = simple.GetColorTransferFunction('velocity_magnitude')

    def hide(self):
        self.contour1Display = simple.Hide(self.contour1, self.renderView)

    def show(self):
        self.contour1Display = simple.Show(self.contour1, self.renderView)

    def showVelocity(self):
        print("drawing velocity for " + self.name)

        # set scalar coloring
        simple.ColorBy(self.contour1Display, ('POINTS', 'velocity_magnitude'))

        # rescale color and/or opacity maps used to include current data range
        self.contour1Display.RescaleTransferFunctionToDataRange(True, False)
        self.renderView.Update()

    def showPressure(self):
        print("drawing pressure for " + self.name)

        # set scalar coloring
        simple.ColorBy(self.contour1Display, ('POINTS', 'pressure'))

        # rescale color and/or opacity maps used to include current data range
        self.contour1Display.RescaleTransferFunctionToDataRange(True, False)
        self.renderView.Update()

    def toggleTankGeometry(self):

        if not self.tankGeometryInit:

            # create a new 'Contour'
            self.contour2 = simple.Contour(Input=self.dataFile)
            self.contour2.PointMergeMethod = 'Uniform Binning'

            # Properties modified on self.contour2
            self.contour2.ContourBy = ['POINTS', 'wall_shear']
            self.contour2.Isosurfaces = [0.0002]

            # show data in view
            self.contour2Display = simple.Show(self.contour2, self.renderView)

            # trace defaults for the display properties.
            self.contour2Display.Representation = 'Surface'
            self.contour2Display.ColorArrayName = [None, '']
            self.contour2Display.OSPRayScaleFunction = 'PiecewiseFunction'
            self.contour2Display.SelectOrientationVectors = 'None'
            self.contour2Display.ScaleFactor = -2.0000000000000002e+298
            self.contour2Display.SelectScaleArray = 'None'
            self.contour2Display.GlyphType = 'Arrow'
            self.contour2Display.GlyphTableIndexArray = 'None'
            self.contour2Display.GaussianRadius = -1.0000000000000001e+298
            self.contour2Display.SetScaleArray = [None, '']
            self.contour2Display.ScaleTransferFunction = 'PiecewiseFunction'
            self.contour2Display.OpacityArray = [None, '']
            self.contour2Display.OpacityTransferFunction = 'PiecewiseFunction'
            self.contour2Display.DataAxesGrid = 'GridAxesRepresentation'
            self.contour2Display.SelectionCellLabelFontFile = ''
            self.contour2Display.SelectionPointLabelFontFile = ''
            self.contour2Display.PolarAxes = 'PolarAxesRepresentation'

            # init the 'GridAxesRepresentation' selected for 'DataAxesGrid'
            self.contour2Display.DataAxesGrid.XTitleFontFile = ''
            self.contour2Display.DataAxesGrid.YTitleFontFile = ''
            self.contour2Display.DataAxesGrid.ZTitleFontFile = ''
            self.contour2Display.DataAxesGrid.XLabelFontFile = ''
            self.contour2Display.DataAxesGrid.YLabelFontFile = ''
            self.contour2Display.DataAxesGrid.ZLabelFontFile = ''

            # init the 'PolarAxesRepresentation' selected for 'PolarAxes'
            self.contour2Display.PolarAxes.PolarAxisTitleFontFile = ''
            self.contour2Display.PolarAxes.PolarAxisLabelFontFile = ''
            self.contour2Display.PolarAxes.LastRadialAxisTextFontFile = ''
            self.contour2Display.PolarAxes.SecondaryRadialAxesTextFontFile = ''

            # Properties modified on contour2Display
            self.contour2Display.Opacity = 0.1

            # change solid color
            self.contour2Display.DiffuseColor = [0.0, 0.5, 0.5]

            self.tankGeometryInit = True
            self.tankGeometryShown = True

        else:
            if self.tankGeometryShown:
                self.contour2Display = simple.Hide(self.contour2, self.renderView)
                self.tankGeometryShown = False
            else:
                self.contour2Display = simple.Show(self.contour2, self.renderView)
                self.tankGeometryShown = True


class AMSTest(pv_protocols.ParaViewWebProtocol):

    def __init__(self, config, profile):
        super(AMSTest, self).__init__()
        self.context = None
        self.extractBlocks = None
        self.colormaps = {}
        self.foreground = [ 1, 1, 1]
        self.background = [ 0, 0, 0]
        self.colorBy = ('__SOLID__', '__SOLID__')
        self.view = simple.GetRenderView()
        self.config = config
        self.profile = profile

        self.dataObjects = []

        self.toggle = True
        self.data0on = True
        self.data1on = False


        # get active view
        self.renderView1 = simple.GetActiveViewOrCreate('RenderView')
        # uncomment following to set a specific view size
        # renderView1.ViewSize = [1638, 1076]

    def initializeData(self):

        self.addObject(AMSDataObject('/Users/tomfool/tech/18/amgen/ams-102-AgileViz/EnSight/mat-viz-mofTFF-90L-9.1lpm-100rpm/mat-viz-mofTFF-90L-9.1lpm-100rpm.case', self.renderView1))
        self.addObject(AMSDataObject('/Users/tomfool/tech/18/amgen/ams-102-AgileViz/EnSight/mat-viz-mofTFF-90L-9.1lpm-250rpm/mat-viz-mofTFF-90L-9.1lpm-250rpm.case', self.renderView1))
        self.dataObjects[0].show()
        self.dataObjects[1].hide()

    def addListener(self, dataChangedInstance):
        self.dataListeners.append(dataChangedInstance)

    def getInput(self):
        return self.dataset

    def addObject(self, dataObject):
        self.dataObjects.append(dataObject)

    @exportRPC("amsprotocol.draw.low.rpm")
    def draw100rpm(self):

        if self.data0on:
            self.dataObjects[0].hide()
            self.data0on = False
        else:
            self.dataObjects[0].show()
            self.data0on = True

        return "**** executed draw100rpm() ****"

    @exportRPC("amsprotocol.draw.high.rpm")
    def draw250rpm(self):

        if self.data1on:
            self.dataObjects[1].hide()
            self.data1on = False
        else:
            self.dataObjects[1].show()
            self.data1on = True

        return "**** executed draw250rpm() ****"


    def takeStandardView(self):

        # current camera placement for renderView1
        self.renderView1.CameraPosition = [1.3051878628081257, -1.32358496378265, -0.017141331493847792]
        self.renderView1.CameraFocalPoint = [-0.052487090229988105, 0.03264869749546056, -0.3026974257081747]
        self.renderView1.CameraViewUp = [-0.5051031518286454, -0.33848038039346323, 0.7939155106820026]
        self.renderView1.CameraParallelScale = 0.502148522908922
        ##################################################


    def modifyImage(self):

        if (self.toggle):
            print("drawing pressure.....")

            # set scalar coloring
            simple.ColorBy(self.contour1Display, ('POINTS', 'pressure'))

            # rescale color and/or opacity maps used to include current data range
            self.contour1Display.RescaleTransferFunctionToDataRange(True, False)
            self.renderView1.Update()


        else:
            print("changing back......")

            # set scalar coloring
            simple.ColorBy(self.contour1Display, ('POINTS', 'velocity_magnitude'))

            # rescale color and/or opacity maps used to include current data range
            self.contour1Display.RescaleTransferFunctionToDataRange(True, False)
            self.renderView1.Update()

        self.toggle = not self.toggle


    @exportRPC("amsprotocol.show.velocity")
    def showVelocity(self):
        print("drawing velocity.")

        self.dataObjects[0].showVelocity()
        self.dataObjects[1].showVelocity()
        return "**** executed showVelocity() ****"


    @exportRPC("amsprotocol.show.pressure")
    def showPressure(self):
        print("drawing pressure.")

        self.dataObjects[0].showPressure()
        self.dataObjects[1].showPressure()
        return "**** executed showPressure() ****"

    @exportRPC("amsprotocol.testbutton")
    def testbutton(self, arg):
        print("toggling.")
        self.modifyImage()
        return "******** executed testbutton with: " + arg + " *******"


    @exportRPC("amsprotocol.show.tank.geometry")
    def showTankGeometry(self):

        self.dataObjects[0].toggleTankGeometry()
        self.renderView1.Update()



