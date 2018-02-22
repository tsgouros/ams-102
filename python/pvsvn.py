# import to process args
import os

# import paraview modules.
from paraview.web import pv_wslink
from paraview.web import protocols as pv_protocols

from paraview import simple
from wslink import server

from wslink import register as exportRPC
from wslink.websocket import LinkProtocol

class amsProtocol(LinkProtocol):
    def __init__(self):
        super(amsProtocol, self).__init__()

    @exportRPC("amsprotocol.testbutton")
    def testbutton(self):
        print("******* HELP ********")


try:
    import argparse
except ImportError:
    # since  Python 2.6 and earlier don't have argparse, we simply provide
    # the source for the same as _argparse and we use it instead.
    from vtk.util import _argparse as argparse

# =============================================================================
# Create custom PVServerProtocol class to handle clients requests
# =============================================================================

class _DemoServer(pv_wslink.PVServerProtocol,amsProtocol):
    authKey = "wslink-secret"
    def initialize(self):
        # Bring used components
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebMouseHandler())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPort())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPortImageDelivery())
        #self.registerVtkWebProtocol(self.testbutton())
        self.updateSecret(_DemoServer.authKey)

        # Disable interactor-based render calls
        simple.GetRenderView().EnableRenderOnInteraction = 0
        simple.GetRenderView().Background = [0,0,0]
        #cone = simple.Cone()
        #simple.Show(cone)

        # create a new 'EnSight Reader'

        #### disable automatic camera reset on 'Show'
        #paraview.simple._DisableFirstRenderCameraReset()

        # create a new 'EnSight Reader'
        matvizmofTFF90L91lpm100rpmcase = simple.EnSightReader(CaseFileName='/Users/tomfool/tech/18/amgen/ams-102-AgileViz/EnSight/mat-viz-mofTFF-90L-9.1lpm-100rpm/mat-viz-mofTFF-90L-9.1lpm-100rpm.case')
        matvizmofTFF90L91lpm100rpmcase.PointArrays = ['pressure', 'pressure_coefficient', 'dynamic_pressure', 'absolute_pressure', 'total_pressure', 'rel_total_pressure', 'density', 'density_all', 'velocity_magnitude', 'x_velocity', 'y_velocity', 'z_velocity', 'axial_velocity', 'radial_velocity', 'tangential_velocity', 'rel_velocity_magnitude', 'relative_x_velocity', 'relative_y_velocity', 'relative_z_velocity', 'rel_tangential_velocity', 'mesh_x_velocity', 'mesh_y_velocity', 'mesh_z_velocity', 'velocity_angle', 'relative_velocity_angle', 'vorticity_mag', 'helicity', 'x_vorticity', 'y_vorticity', 'z_vorticity', 'cell_reynolds_number', 'turb_kinetic_energy', 'turb_intensity', 'turb_diss_rate', 'production_of_k', 'viscosity_turb', 'viscosity_eff', 'viscosity_ratio', 'y_star', 'y_plus', 'uds_0_scalar', 'uds_0_diff_scalar', 'viscosity_lam', 'wall_shear', 'x_wall_shear', 'y_wall_shear', 'z_wall_shear', 'skin_friction_coef', 'cell_partition_active', 'cell_partition_stored', 'cell_id', 'cell_element_type', 'cell_type', 'cell_zone', 'partition_neighbors', 'cell_weight', 'x_coordinate', 'y_coordinate', 'z_coordinate', 'axial_coordinate', 'angular_coordinate', 'abs_angular_coordinate', 'radial_coordinate', 'face_area_magnitude', 'x_face_area', 'y_face_area', 'z_face_area', 'cell_volume', 'orthogonal_quality', 'cell_equiangle_skew', 'cell_equivolume_skew', 'face_handedness', 'mark_poor_elememts', 'interface_overlap_fraction', 'cell_wall_distance', 'adaption_function', 'adaption_curvature', 'adaption_space_gradient', 'adaption_iso_value', 'boundary_cell_dist', 'boundary_normal_dist', 'cell_volume_change', 'cell_surface_area', 'cell_warp', 'cell_children', 'cell_refine_level', 'mass_imbalance', 'strain_rate_mag', 'dx_velocity_dx', 'dy_velocity_dx', 'dz_velocity_dx', 'dx_velocity_dy', 'dy_velocity_dy', 'dz_velocity_dy', 'dx_velocity_dz', 'dy_velocity_dz', 'dz_velocity_dz', 'dp_dx', 'dp_dy', 'dp_dz', 'velocity']

        # get active view
        renderView1 = simple.GetActiveViewOrCreate('RenderView')
        # uncomment following to set a specific view size
        # renderView1.ViewSize = [1638, 1076]

        # show data in view
        matvizmofTFF90L91lpm100rpmcaseDisplay = simple.Show(matvizmofTFF90L91lpm100rpmcase, renderView1)

        # get color transfer function/color map for 'pressure'
        pressureLUT = simple.GetColorTransferFunction('pressure')

        # get opacity transfer function/opacity map for 'pressure'
        pressurePWF = simple.GetOpacityTransferFunction('pressure')

        # trace defaults for the display properties.
        matvizmofTFF90L91lpm100rpmcaseDisplay.Representation = 'Surface'
        matvizmofTFF90L91lpm100rpmcaseDisplay.ColorArrayName = ['POINTS', 'pressure']
        matvizmofTFF90L91lpm100rpmcaseDisplay.LookupTable = pressureLUT
        matvizmofTFF90L91lpm100rpmcaseDisplay.OSPRayScaleArray = 'pressure'
        matvizmofTFF90L91lpm100rpmcaseDisplay.OSPRayScaleFunction = 'PiecewiseFunction'
        matvizmofTFF90L91lpm100rpmcaseDisplay.SelectOrientationVectors = 'velocity'
        matvizmofTFF90L91lpm100rpmcaseDisplay.ScaleFactor = 0.07445502169430256
        matvizmofTFF90L91lpm100rpmcaseDisplay.SelectScaleArray = 'pressure'
        matvizmofTFF90L91lpm100rpmcaseDisplay.GlyphType = 'Arrow'
        matvizmofTFF90L91lpm100rpmcaseDisplay.GlyphTableIndexArray = 'pressure'
        matvizmofTFF90L91lpm100rpmcaseDisplay.GaussianRadius = 0.03722751084715128
        matvizmofTFF90L91lpm100rpmcaseDisplay.SetScaleArray = ['POINTS', 'pressure']
        matvizmofTFF90L91lpm100rpmcaseDisplay.ScaleTransferFunction = 'PiecewiseFunction'
        matvizmofTFF90L91lpm100rpmcaseDisplay.OpacityArray = ['POINTS', 'pressure']
        matvizmofTFF90L91lpm100rpmcaseDisplay.OpacityTransferFunction = 'PiecewiseFunction'
        matvizmofTFF90L91lpm100rpmcaseDisplay.DataAxesGrid = 'GridAxesRepresentation'
        matvizmofTFF90L91lpm100rpmcaseDisplay.SelectionCellLabelFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.SelectionPointLabelFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.PolarAxes = 'PolarAxesRepresentation'
        matvizmofTFF90L91lpm100rpmcaseDisplay.ScalarOpacityFunction = pressurePWF
        matvizmofTFF90L91lpm100rpmcaseDisplay.ScalarOpacityUnitDistance = 0.007476863260594431

        # init the 'PiecewiseFunction' selected for 'ScaleTransferFunction'
        matvizmofTFF90L91lpm100rpmcaseDisplay.ScaleTransferFunction.Points = [-152.6022491455078, 0.0, 0.5, 0.0, 144.73870849609375, 1.0, 0.5, 0.0]

        # init the 'PiecewiseFunction' selected for 'OpacityTransferFunction'
        matvizmofTFF90L91lpm100rpmcaseDisplay.OpacityTransferFunction.Points = [-152.6022491455078, 0.0, 0.5, 0.0, 144.73870849609375, 1.0, 0.5, 0.0]

        # init the 'GridAxesRepresentation' selected for 'DataAxesGrid'
        matvizmofTFF90L91lpm100rpmcaseDisplay.DataAxesGrid.XTitleFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.DataAxesGrid.YTitleFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.DataAxesGrid.ZTitleFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.DataAxesGrid.XLabelFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.DataAxesGrid.YLabelFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.DataAxesGrid.ZLabelFontFile = ''

        # init the 'PolarAxesRepresentation' selected for 'PolarAxes'
        matvizmofTFF90L91lpm100rpmcaseDisplay.PolarAxes.PolarAxisTitleFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.PolarAxes.PolarAxisLabelFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.PolarAxes.LastRadialAxisTextFontFile = ''
        matvizmofTFF90L91lpm100rpmcaseDisplay.PolarAxes.SecondaryRadialAxesTextFontFile = ''

        # reset view to fit data
        renderView1.ResetCamera()

        # show color bar/color legend
        matvizmofTFF90L91lpm100rpmcaseDisplay.SetScalarBarVisibility(renderView1, True)

        # update the view to ensure updated data information
        renderView1.Update()

        # hide data in view
        simple.Hide(matvizmofTFF90L91lpm100rpmcase, renderView1)

        # create a new 'Contour'
        contour1 = simple.Contour(Input=matvizmofTFF90L91lpm100rpmcase)
        contour1.ContourBy = ['POINTS', 'pressure']
        contour1.Isosurfaces = [-3.9317703247070312]
        contour1.PointMergeMethod = 'Uniform Binning'

        # Properties modified on contour1
        contour1.ContourBy = ['POINTS', 'uds_0_scalar']
        contour1.Isosurfaces = [480.0, 570.0]

        # show data in view
        contour1Display = simple.Show(contour1, renderView1)

        # trace defaults for the display properties.
        contour1Display.Representation = 'Surface'
        contour1Display.ColorArrayName = ['POINTS', 'pressure']
        contour1Display.LookupTable = pressureLUT
        contour1Display.OSPRayScaleArray = 'Normals'
        contour1Display.OSPRayScaleFunction = 'PiecewiseFunction'
        contour1Display.SelectOrientationVectors = 'velocity'
        contour1Display.ScaleFactor = 0.07228952534496784
        contour1Display.SelectScaleArray = 'None'
        contour1Display.GlyphType = 'Arrow'
        contour1Display.GlyphTableIndexArray = 'None'
        contour1Display.GaussianRadius = 0.03614476267248392
        contour1Display.SetScaleArray = ['POINTS', 'Normals']
        contour1Display.ScaleTransferFunction = 'PiecewiseFunction'
        contour1Display.OpacityArray = ['POINTS', 'Normals']
        contour1Display.OpacityTransferFunction = 'PiecewiseFunction'
        contour1Display.DataAxesGrid = 'GridAxesRepresentation'
        contour1Display.SelectionCellLabelFontFile = ''
        contour1Display.SelectionPointLabelFontFile = ''
        contour1Display.PolarAxes = 'PolarAxesRepresentation'

        # init the 'PiecewiseFunction' selected for 'ScaleTransferFunction'
        contour1Display.ScaleTransferFunction.Points = [-0.9995924830436707, 0.0, 0.5, 0.0, 0.9998393058776855, 1.0, 0.5, 0.0]

        # init the 'PiecewiseFunction' selected for 'OpacityTransferFunction'
        contour1Display.OpacityTransferFunction.Points = [-0.9995924830436707, 0.0, 0.5, 0.0, 0.9998393058776855, 1.0, 0.5, 0.0]

        # init the 'GridAxesRepresentation' selected for 'DataAxesGrid'
        contour1Display.DataAxesGrid.XTitleFontFile = ''
        contour1Display.DataAxesGrid.YTitleFontFile = ''
        contour1Display.DataAxesGrid.ZTitleFontFile = ''
        contour1Display.DataAxesGrid.XLabelFontFile = ''
        contour1Display.DataAxesGrid.YLabelFontFile = ''
        contour1Display.DataAxesGrid.ZLabelFontFile = ''

        # init the 'PolarAxesRepresentation' selected for 'PolarAxes'
        contour1Display.PolarAxes.PolarAxisTitleFontFile = ''
        contour1Display.PolarAxes.PolarAxisLabelFontFile = ''
        contour1Display.PolarAxes.LastRadialAxisTextFontFile = ''
        contour1Display.PolarAxes.SecondaryRadialAxesTextFontFile = ''

        # reset view to fit data
        renderView1.ResetCamera()

        # hide data in view
        simple.Hide(matvizmofTFF90L91lpm100rpmcase, renderView1)

        # show color bar/color legend
        contour1Display.SetScalarBarVisibility(renderView1, True)

        # update the view to ensure updated data information
        renderView1.Update()

        # set scalar coloring
        simple.ColorBy(contour1Display, ('POINTS', 'velocity_magnitude'))

        # rescale color and/or opacity maps used to include current data range
        contour1Display.RescaleTransferFunctionToDataRange(True, False)

        # show color bar/color legend
        contour1Display.SetScalarBarVisibility(renderView1, True)

        # get color transfer function/color map for 'velocity_magnitude'
        velocity_magnitudeLUT = simple.GetColorTransferFunction('velocity_magnitude')

        #### saving camera placements for all active views

        # current camera placement for renderView1
        renderView1.CameraPosition = [1.3051878628081257, -1.32358496378265, -0.017141331493847792]
        renderView1.CameraFocalPoint = [-0.052487090229988105, 0.03264869749546056, -0.3026974257081747]
        renderView1.CameraViewUp = [-0.5051031518286454, -0.33848038039346323, 0.7939155106820026]
        renderView1.CameraParallelScale = 0.5021485229089222

#### uncomment the following to render all views
# RenderAllViews()
# alternatively, if you want to write images, you can use SaveScreenshot(...).


### OLD FOLLOWS

        simple.Render()

        # Update interaction mode
        pxm = simple.servermanager.ProxyManager()
        interactionProxy = pxm.GetProxy('settings', 'RenderViewInteractionSettings')
        interactionProxy.Camera3DManipulators = ['Rotate', 'Pan', 'Zoom', 'Pan', 'Roll', 'Pan', 'Zoom', 'Rotate', 'Zoom']

# =============================================================================
# Main: Parse args and start server
# =============================================================================

if __name__ == "__main__":
    # Create argument parser
    parser = argparse.ArgumentParser(description="ParaViewWeb Demo")

    # Add default arguments
    server.add_arguments(parser)

    # Extract arguments
    args = parser.parse_args()

    # Start server
    server.start_webserver(options=args, protocol=_DemoServer)




