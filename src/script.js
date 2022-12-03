import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { LoopOnce, SphereGeometry, TextureLoader, Vector3 } from 'three'
import $ from "./Jquery"
import gsap from "gsap"
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Cylinder, GridBroadphase } from 'cannon'
import CANNON from 'cannon'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
const textureLoader = new THREE.TextureLoader()

const raycaster = new THREE.Raycaster()

//cannon
// console.log(CANNON)
const world = new CANNON.World()
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.gravity.set(0, - 9.82, 0)

const defaultMaterial = new CANNON.Material('default')
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 20,
        restitution: 0.001
    }
)
//physics floor
const floorShape = new CANNON.Plane()
const floorBody = new CANNON.Body()
floorBody.mass = 0
floorBody.position=new CANNON.Vec3(0, -2, 0)
floorBody.addShape(floorShape)
floorBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(-1,0,0),
    Math.PI *0.5
)
world.addBody(floorBody)

let reticle= null
let camera;
let renderer;
const container = document.createElement('div');
document.body.appendChild(container);

//physics sweeper
const sweeperShape = new CANNON.Sphere(3)
const sweeperBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(0, -3.5, 0),
    shape: sweeperShape,
    material: defaultMaterial
})
world.addBody(sweeperBody)

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

const gltfLoader = new GLTFLoader()

let hitTestSource = null;
let localSpace = null;
let hitTestSourceInitialized = false;

renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true; // we have to enable the renderer for webxr
const controller= renderer.xr.getController(0);
scene.add(controller)


async function initializeHitTestSource() {
const session = renderer.xr.getSession();
  
  // Reference spaces express relationships between an origin and the world.

  // For hit testing, we use the "viewer" reference space,
  // which is based on the device's pose at the time of the hit test.
  const viewerSpace = await session.requestReferenceSpace("viewer");
  hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

  // We're going to use the reference space of "local" for drawing things.
  // which gives us stability in terms of the environment.
  // read more here: https://developer.mozilla.org/en-US/docs/Web/API/XRReferenceSpace
  localSpace = await session.requestReferenceSpace("local");

  // set this to true so we don't request another hit source for the rest of the session
  hitTestSourceInitialized = true;
  
  // In case we close the AR session by hitting the button "End AR"
  session.addEventListener("end", () => {
    hitTestSourceInitialized = false;
    hitTestSource = null;
  });
}
//add reticle to scene
function addReticleToScene(){

  const geometry = new THREE.RingBufferGeometry(0.15,0.2,32).rotateX(-Math.PI/2);
  const material = new THREE.MeshBasicMaterial();
  reticle = new THREE.Mesh(geometry, material);
  
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  }

camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);

function init() {
  addReticleToScene()
    
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"]
  });
  
        document.body.appendChild(button);
  
        window.addEventListener('resize', onWindowResize, false);

    }
  
//list all the variables
let action = "tree";
let tree1main;
let tree2main;
let tree3main;
let tree1;
let tree2;
let tree3;
let leaf;
let sweeperTool;
let leafGeo;
let treeIntersect = []
let objectsToUpdate = [];
let trees = [];
let animations = [];


const sweeperGeo = new THREE.SphereGeometry(3)
const sweeperGeoMaterial = new THREE.MeshStandardMaterial({color:"green", opacity:0.0, transparent:true})
const sweeperMesh = new THREE.Mesh(sweeperGeo, sweeperGeoMaterial)
scene.add(sweeperMesh)


gltfLoader.load(

  '/trees.glb',
  (gltf) =>
  {
    tree1main = gltf
    tree1 = gltf.scene
    console.log("tree1")
    console.log(tree1)
  }
)
gltfLoader.load(

  '/trees2.glb',
  (gltf) =>
  {
    tree2main = gltf
    tree2 = gltf.scene
    console.log("tree2")
    console.log(tree2)
  }
)

gltfLoader.load(

  '/trees3.glb',
  (gltf) =>
  {
    tree3main = gltf
    tree3 = gltf.scene
    console.log("tree3")
    console.log(tree3)
  }
)


gltfLoader.load(
    '/leaf.glb',
    (gltf) =>
    {
        let leafscene=gltf.scene
        
        leafGeo = leafscene.children[0].geometry




        for (let i=0; i<200; i++){
          createLeafInitial(.2,{
            x: (Math.random() *20) - 10,
            y: -1,
            z: (Math.random() *10)*-1 
          })
          }


    }
)

const leavesFall=()=>{

  if(treeIntersect.length>0){
    
    const selectedTree = treeIntersect[0].object
    let selectedTreeParent;
    let mixerTree; 
    let leaveMass;
    
    // console.log(treeIntersect[0])
    let actionTree;
    switch(selectedTree.name){
      case "leaves":
        leaveMass = selectedTree;
        selectedTreeParent = selectedTree.parent.parent
        mixerTree = new THREE.AnimationMixer(selectedTreeParent)
        actionTree = mixerTree.clipAction(tree1main.animations[0])
           // actionTree.clampWhenFinished = true;
    actionTree.timeScale=.5
    actionTree.setLoop( THREE.LoopOnce )
    animations.push(mixerTree)
    actionTree.play();
        break;
      case "leaves001":
        leaveMass = selectedTree;
        selectedTreeParent = selectedTree.parent.parent
        mixerTree = new THREE.AnimationMixer(selectedTreeParent)
        actionTree = mixerTree.clipAction(tree2main.animations[0])
           // actionTree.clampWhenFinished = true;
    actionTree.timeScale=.5
    actionTree.setLoop( THREE.LoopOnce )
    animations.push(mixerTree)
    actionTree.play();
        break;

      case "leaves002":
        leaveMass = selectedTree;
        selectedTreeParent = selectedTree.parent.parent
        mixerTree = new THREE.AnimationMixer(selectedTreeParent)
        
        actionTree = mixerTree.clipAction(tree3main.animations[0])
           // actionTree.clampWhenFinished = true;
    actionTree.timeScale=.5
    actionTree.setLoop( THREE.LoopOnce )
    animations.push(mixerTree)
    actionTree.play();
    break;
    case "tree":
    leaveMass = selectedTree.parent.children[0].children[0].children[0];
    selectedTreeParent = selectedTree.parent
     mixerTree = new THREE.AnimationMixer(selectedTreeParent)
      actionTree = mixerTree.clipAction(tree1main.animations[0])
         // actionTree.clampWhenFinished = true;
  actionTree.timeScale=.5
  actionTree.setLoop( THREE.LoopOnce )
  animations.push(mixerTree)
  actionTree.play();
      break;
    case "tree001":
      leaveMass = selectedTree.parent.children[0].children[0].children[0];
     selectedTreeParent = selectedTree.parent
     mixerTree = new THREE.AnimationMixer(selectedTreeParent)
      actionTree = mixerTree.clipAction(tree2main.animations[0])
         // actionTree.clampWhenFinished = true;
  actionTree.timeScale=.5
  actionTree.setLoop( THREE.LoopOnce )
  animations.push(mixerTree)
  actionTree.play();
      break;

    case "tree002":
      leaveMass = selectedTree.parent.children[0].children[0].children[0];
      selectedTreeParent = selectedTree.parent
     mixerTree = new THREE.AnimationMixer(selectedTreeParent)
      actionTree = mixerTree.clipAction(tree3main.animations[0])
         // actionTree.clampWhenFinished = true;
  actionTree.timeScale=.5
  actionTree.setLoop( THREE.LoopOnce )
  animations.push(mixerTree)
  actionTree.play();


    }

    
   console.log(leaveMass)
  //  leaveMass.updateMatrixWorld();
  //  let leaveMassClone = leaveMass.clone()
   
  // leaveMassClone.applyMatrix4( leaveMass.matrixWorld );
   let DotCount = leaveMass.geometry.getAttribute('position')
   for (let i=0; i<20; i++){
    let randomLeaf = Math.floor(Math.random()*10000)
    let vertex = new THREE.Vector3();
    vertex.fromBufferAttribute( DotCount, randomLeaf );
    leaveMass.localToWorld( vertex );
    
    createLeafInitial(.2,
      vertex
    )
    



   }
 

    // console.log("selected tree")
    // console.log(mixerTree)
    // console.log(treeIntersect)

  }
}


const createTree = function(){

  
  let treeMesh;

 
  let randTree= Math.floor(Math.random()*3+1)

  switch(randTree){
    case 1 : treeMesh = SkeletonUtils.clone(tree1)
    break;

    case 2 :  treeMesh = SkeletonUtils.clone(tree2)
    break;

    case 3 :  treeMesh = SkeletonUtils.clone(tree3)
    }
    treeMesh.scale.set(.3,.3,.3)
    treeMesh.position.setFromMatrixPosition(reticle.matrix);
    // newFlower.quaternion.setFromRotationMatrix(reticle.matrix);
    // console.log(reticle)
    // if( reticle.quaternion.z > Math.PI*.1 || reticle.quaternion.x>Math.PI*.1 ){

      treeMesh.position.y = 1


    scene.add(treeMesh)
    trees.push(treeMesh)

    
    gsap.to( treeMesh.position,{duration:.3,y:-2})

 
   

}


const sweepLeaves = ()=>{
  console.log("sweepleaves")
  var sweepPosition = new THREE.Vector3();
  // console.log(reticle);
  sweepPosition.getPositionFromMatrix( reticle.matrixWorld );
  // console.log(sweepPosition);
  gsap.to( sweeperBody.position,{duration:.3,z:sweepPosition.z, x:sweepPosition.x })

  // sweeperBody.position.set(sweepPosition.x,-3.5,sweepPosition.z)
  // console.log(sweeperBody);
  // sweepertool.position.setFromMatrixPosition(reticle.matrix);


}


const createLeafInitial = (radius, position) =>
{
    const LeafColor = function getRandomColor() {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
      }
      const leafMaterial = new THREE.MeshStandardMaterial({color:LeafColor()})

    // Three.js mesh
    
    const mesh = new THREE.Mesh(leafGeo, leafMaterial)
    mesh.scale.set(radius, radius, radius)
    // mesh.rotation.y=Math.PI*.5
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js body
    const shape = new CANNON.Box(new CANNON.Vec3(.2,.4,.01))

    const body = new CANNON.Body({
        mass: .01,
        position: new CANNON.Vec3(0, 1, -1),
        shape: shape,
        material: defaultMaterial
    })
    body.position.copy(position)
    // body.applyForce(new CANNON.Vec3(0, 0, -10), body.position)
    body.applyLocalForce(new CANNON.Vec3(0, .1, -.1), body.position)

    // body.addEventListener('collide', playHitSound)

    world.addBody(body)

    // Save in objects
    objectsToUpdate.push({ mesh, body })
}


const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}
window.addEventListener('resize', () =>
{
  // Update sizes
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  // Update camera
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

})

  
container.appendChild(renderer.domElement);


controller.addEventListener('select', ()=>{


  leavesFall();

 
  if(reticle.visible){
    if(action =="tree" && treeIntersect.length<1){
    createTree();
    }
    else if(action =="sweep"){
    sweepLeaves()
    }
  
  }
    })
/**
 * Lights
 */
 const ambientLight = new THREE.AmbientLight('white', .2)
 scene.add(ambientLight)
 
 const directionalLight = new THREE.DirectionalLight('orange', 1)
 directionalLight.castShadow = true
 directionalLight.shadow.mapSize.set(1024, 1024)
 directionalLight.shadow.camera.far = 15
 directionalLight.shadow.camera.left = - 7
 directionalLight.shadow.camera.top = 7
 directionalLight.shadow.camera.right = 7
 directionalLight.shadow.camera.bottom = - 7
 directionalLight.position.set(- 5, 5, 0)
 scene.add(directionalLight)



const grassMaterial = new THREE.MeshBasicMaterial({color:"green"})


function animate() {
  renderer.setAnimationLoop(render);
}
let oldElapsedTime=null;

const clock = new THREE.Clock()
let previousTime = 0


// animate();




  function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
  }




init();






animate();

function render(timestamp, frame) {
const elapsedTime = clock.getElapsedTime()
const deltaTime = elapsedTime - oldElapsedTime
oldElapsedTime = elapsedTime
raycaster.setFromCamera(new THREE.Vector3(0,0,-.05).applyMatrix4(controller.matrixWorld), camera)

//tree Intersect

treeIntersect = raycaster.intersectObjects(trees)





  if(animations.length>0)

{
  
  animations.forEach(function(mixer){
      mixer.update(deltaTime)

  })

}

renderer.render(scene, camera);

for(const object of objectsToUpdate)
{
    object.mesh.position.copy(object.body.position)
    object.mesh.quaternion.copy(object.body.quaternion)
    // object.body.applyForce(new CANNON.Vec3(- 10, 0, 0), object.body.position)
}

sweeperMesh.position.copy(sweeperBody.position)

  if(frame){
    
    if(!hitTestSourceInitialized){
      initializeHitTestSource();
    }
  }
  
  if(hitTestSourceInitialized){
    const hitTestResults = frame.getHitTestResults(hitTestSource);
    // console.log(hitTestResults)
    
    if(hitTestResults.length>0){
      const hit = hitTestResults[0]
      
      const pose = hit.getPose(localSpace)
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix)
    }
    else{
      reticle.visible=false
    }
  }
  
   
  world.step(1 / 60, deltaTime, 3)

}