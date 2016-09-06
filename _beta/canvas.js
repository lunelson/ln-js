/*

COMMMON

  ctx.clearRect
  ctx.save
  ctx.translate
  ctx.rotate
  ctx.restore

NB
  - mousemove and similar events will output clientX and clientY relative to center of screen. If your canvas is not centred on screen (the usual case) you need to **translate** these values in to the space of the canvas
  - Math.atan takes a ratio (O/A), like the other arc- functions; however Math.atan2 takes the actual Y and X value (in that order), so it has more information about which 'quadrant' you are in.

VECTORS
  - can be represented as length/angle or X,Y
  - conversion
    X = length * cos(angle)
    Y = length * sin(angle)
    angle = atan2(Y,X)
    length = sqrt(pow(X, 2)+pow(Y, 2))
  - can be added or subtractedin terms of their X,Y
  - can be multiplied or divided in terms of their length OR X,Y

 */

