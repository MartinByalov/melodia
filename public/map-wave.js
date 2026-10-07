// Uniform-only spatial color wave, shared by overview and texture-backed lines.
export function installMapWave(material){
  const uniforms={wavePhase:{value:0},waveStrength:{value:0},waveColor:{value:material.color.clone()}};
  Object.assign(material.uniforms,uniforms);
  material.vertexShader='varying float mapLatitude;\n'+material.vertexShader;
  material.vertexShader=material.vertexShader.replace('vec4 start = modelViewMatrix', 'mapLatitude = mix(instanceStart.y,instanceEnd.y,position.y < .5 ? 0.0 : 1.0);\n vec4 start = modelViewMatrix');
  material.fragmentShader='varying float mapLatitude; uniform float wavePhase, waveStrength; uniform vec3 waveColor;\n'+material.fragmentShader;
  material.fragmentShader=material.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, alpha );','float band=pow(.5+.5*cos(mapLatitude*9.0-wavePhase*6.2831853),6.0);\n vec4 diffuseColor = vec4(mix(diffuse,waveColor,band*waveStrength), alpha);');
  return uniforms;
}