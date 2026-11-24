Add-Type -AssemblyName System.Drawing

$iconDirectory = Join-Path $PSScriptRoot '..\extension\icons'
$iconDirectory = [System.IO.Path]::GetFullPath($iconDirectory)
$scale = 4
$canvas = [System.Drawing.Bitmap]::new(128 * $scale, 128 * $scale, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.ScaleTransform([single]$scale, [single]$scale)

$background = [System.Drawing.RectangleF]::new(4, 4, 120, 120)
$tile = [System.Drawing.Drawing2D.GraphicsPath]::new()
$radius = 27
$tile.AddArc(4, 4, $radius * 2, $radius * 2, 180, 90)
$tile.AddArc(124 - $radius * 2, 4, $radius * 2, $radius * 2, 270, 90)
$tile.AddArc(124 - $radius * 2, 124 - $radius * 2, $radius * 2, $radius * 2, 0, 90)
$tile.AddArc(4, 124 - $radius * 2, $radius * 2, $radius * 2, 90, 90)
$tile.CloseFigure()
$tileBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($background, [System.Drawing.Color]::FromArgb(39, 44, 54), [System.Drawing.Color]::FromArgb(15, 18, 24), 45)
$graphics.FillPath($tileBrush, $tile)
$edgePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 240, 198, 90), 1.2)
$graphics.DrawPath($edgePen, $tile)

$glowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(22, 240, 198, 90))
$graphics.FillEllipse($glowBrush, 24, 20, 82, 82)

$tagPoints = [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(28, 31),
  [System.Drawing.PointF]::new(68, 31),
  [System.Drawing.PointF]::new(98, 61),
  [System.Drawing.PointF]::new(61, 98),
  [System.Drawing.PointF]::new(28, 65)
)
$tagPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
$tagPath.AddPolygon($tagPoints)
$tagBounds = [System.Drawing.RectangleF]::new(28, 31, 70, 67)
$tagBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($tagBounds, [System.Drawing.Color]::FromArgb(255, 236, 190, 73), [System.Drawing.Color]::FromArgb(255, 255, 218, 116), 135)
$graphics.FillPath($tagBrush, $tagPath)
$tagEdge = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 226, 151), 1.4)
$tagEdge.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawPath($tagEdge, $tagPath)

$holeFill = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 38, 43, 52))
$graphics.FillEllipse($holeFill, 39, 40, 12, 12)
$holeEdge = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(210, 255, 230, 160), 1.5)
$graphics.DrawEllipse($holeEdge, 39, 40, 12, 12)

$chartPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 38, 43, 52), 4.2)
$chartPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$chartPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$chartPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawLines($chartPen, [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(49, 59),
  [System.Drawing.PointF]::new(59, 65),
  [System.Drawing.PointF]::new(68, 58),
  [System.Drawing.PointF]::new(78, 72)
))
$arrowPoints = [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(70, 70),
  [System.Drawing.PointF]::new(79, 74),
  [System.Drawing.PointF]::new(81, 64)
)
$arrowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 38, 43, 52))
$graphics.FillPolygon($arrowBrush, $arrowPoints)

foreach ($size in @(16, 32, 48, 128)) {
  $output = Join-Path $iconDirectory "icon$size.png"
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $target = [System.Drawing.Graphics]::FromImage($bitmap)
  $target.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $target.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $target.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $target.DrawImage($canvas, [System.Drawing.Rectangle]::new(0, 0, $size, $size))
  $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
  $target.Dispose(); $bitmap.Dispose()
}

$graphics.Dispose(); $canvas.Dispose(); $tile.Dispose(); $tileBrush.Dispose(); $edgePen.Dispose(); $glowBrush.Dispose()
$tagPath.Dispose(); $tagBrush.Dispose(); $tagEdge.Dispose(); $holeFill.Dispose(); $holeEdge.Dispose(); $chartPen.Dispose(); $arrowBrush.Dispose()
