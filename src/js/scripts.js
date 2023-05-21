// Imports - 3D JavaScript Libraries
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import CannonDebugger from 'cannon-es-debugger'
import * as CANNON from 'cannon-es';
import spaceBackground from '../img/space.jpg';

// MODEL ASSETS
const spaceshipModel = new URL('../assets/spaceship/Spaceship_RaeTheRedPanda.gltf', import.meta.url) 
const collisionDebug = false



// CHARACTER CONTROLS
class CharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};
class CharacterController {
  constructor(params) {
    this._Init(params);
  }

  _Init(params) {
    this._params = params;
    this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(1, 0.25, 1000.0);
    this._velocity = new THREE.Vector3(0, 0, 0);
    this._position = new THREE.Vector3();

    this._animations = {};
    this._input = new CharacterControllerInput();
    this._stateMachine = new CharacterFSM(
        new CharacterControllerProxy(this._animations));

    this._LoadModels();
  }

  _LoadModels() {
    const progressBar = document.getElementById('progress-bar');
    const loader = new GLTFLoader();
    loader.load(spaceshipModel.href, (gltf) => {
      gltf.scene.scale.setScalar(10);
      gltf.scene.traverse(c => {
        c.castShadow = true;
      });
      this._target = gltf.scene;
      this._params.scene.add(this._target);

      this._mixer = new THREE.AnimationMixer(this._target);
      
      this._manager = new THREE.LoadingManager();
      this._manager.onProgress = function(url, loaded, total) {
        progressBar.value = (loaded / total) * 100;
      };
      const progressBarContainer = document.querySelector('.progress-bar-container');
      this._manager.onLoad = () => {
        progressBarContainer.style.display = 'none';
        this._stateMachine.SetState('idle');
      };

      const _OnLoad = (animName, anim) => {
        const clips = anim.animations;
        const actions = {};
      
        clips.forEach((clip) => {
          const action = this._mixer.clipAction(clip);
          actions[clip.name] = {
            clip: clip,
            action: action,
          };
        });
      
        this._animations[animName] = actions;
      };
      
      const loader = new GLTFLoader(this._manager);
      loader.load(spaceshipModel.href, (gltf) => {
        _OnLoad('walk', gltf);
      });
      loader.load(spaceshipModel.href, (gltf) => {
        _OnLoad('run', gltf);
      });
      loader.load(spaceshipModel.href, (gltf) => {
        _OnLoad('idle', gltf);
      });
    });
  }

  get Position() {
    return this._position;
  }

  get Rotation() {
    if (!this._target) {
      return new THREE.Quaternion();
    }
    return this._target.quaternion;
  }

  Update(timeInSeconds) {
    if (!this._stateMachine._currentState) {
      return;
    }

    this._stateMachine.Update(timeInSeconds, this._input);

    const velocity = this._velocity;
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));

    velocity.add(frameDecceleration);

    const controlObject = this._target;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();

    const acc = this._acceleration.clone();
    if (this._input._keys.shift) {
      acc.multiplyScalar(2.0);
    }

    if (this._input._keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }
    if (this._input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }

    if (this._input._keys.left) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }
    if (this._input._keys.right) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }

    controlObject.quaternion.copy(_R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    this._position.copy(controlObject.position);

    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
};

// Input Mappings
class CharacterControllerInput {
  constructor() {
    this._Init();    
  }

  _Init() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    };
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 87: // w
        this._keys.forward = true;
        break;
      case 65: // a
        this._keys.left = true;
        break;
      case 83: // s
        this._keys.backward = true;
        break;
      case 68: // d
        this._keys.right = true;
        break;
      case 32: // SPACE
        this._keys.space = true;
        break;
      case 16: // SHIFT
        this._keys.shift = true;
        break;
    }
  }

  _onKeyUp(event) {
    switch(event.keyCode) {
      case 87: // w
        this._keys.forward = false;
        break;
      case 65: // a
        this._keys.left = false;
        break;
      case 83: // s
        this._keys.backward = false;
        break;
      case 68: // d
        this._keys.right = false;
        break;
      case 32: // SPACE
        this._keys.space = false;
        break;
      case 16: // SHIFT
        this._keys.shift = false;
        break;
    }
  }
};


// CHARACTER STATE MACHINE
class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
};

class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState('idle', IdleState);
    this._AddState('walk', WalkState);
    this._AddState('run', RunState);
  }
};

class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
};

class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState('run');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};

class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'run';
  }

  Enter(prevState) {
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (!input._keys.shift) {
        this._parent.SetState('walk');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};

class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
  }

  Exit() {
  }

  Update(_, input) {
    if (input._keys.forward || input._keys.backward) {
      this._parent.SetState('walk');
    } 
  }
};


// CAMERA CONTROLS
class ThirdPersonCamera {
  constructor(params) {
    this._params = params;
    this._camera = params.camera;

    this._currentPosition = new THREE.Vector3();
    this._currentLookat = new THREE.Vector3();
  }

  _CalculateIdealOffset() {
    const idealOffset = new THREE.Vector3(0, 80, -100);
    idealOffset.applyQuaternion(this._params.target.Rotation);
    idealOffset.add(this._params.target.Position);
    return idealOffset;
  }

  _CalculateIdealLookat() {
    const idealLookat = new THREE.Vector3(0, 10, 50);
    idealLookat.applyQuaternion(this._params.target.Rotation);
    idealLookat.add(this._params.target.Position);
    return idealLookat;
  }

  Update(timeElapsed) {
    const idealOffset = this._CalculateIdealOffset();
    const idealLookat = this._CalculateIdealLookat();

    const t = 1.0 - Math.pow(0.001, timeElapsed);

    this._currentPosition.lerp(idealOffset, t);
    this._currentLookat.lerp(idealLookat, t);

    this._camera.position.copy(this._currentPosition);
    this._camera.lookAt(this._currentLookat);
  }
}

// WORLD SCENE
class World {
  constructor() {
    this._Initialize();
  }

  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);

    // World Settings
    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(25, 10, 25);

    // New Scene
    this._scene = new THREE.Scene();

    // World Light
    let light = new THREE.DirectionalLight(0xFFFFFF, 1);
    light.position.set(0, 1000, 200);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 16384;
    light.shadow.mapSize.height = 16384;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 5000.0;
    light.shadow.camera.left = 5000;
    light.shadow.camera.right = -5000;
    light.shadow.camera.top = 5000;
    light.shadow.camera.bottom = -5000;
    this._scene.add(light);

    light = new THREE.AmbientLight(0xFFFFFF, 0.25);
    this._scene.add(light);

    // World Walls
    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
      spaceBackground,
      spaceBackground,
      spaceBackground,
      spaceBackground,
      spaceBackground,
      spaceBackground,
    ]);
    texture.encoding = THREE.sRGBEncoding;
    this._scene.background = texture;
    
    // World Ground
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(5000, 5000, 10, 10),
        new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.5, // Frosting
          }));
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this._scene.add(plane);

    // PHYSICS
    this.physicalWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -90, 0)
    });

    this.timeStep = 1 / 60;

    const physicalGround = new CANNON.Body({
      shape: new CANNON.Box(new CANNON.Vec3(2500, 2500, 0.1)),
      type: CANNON.Body.STATIC,
    });  
    this.physicalWorld.addBody(physicalGround); 
    physicalGround.quaternion.setFromEuler(-Math.PI / 2, 0, 0);



    // OBJECTS

    // Practice Objects
    // Box
    const bigBoxGeo = new THREE.BoxGeometry(10, 10, 10);
    const bigBoxMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
    });
    this.bigBoxMesh = new THREE.Mesh(bigBoxGeo, bigBoxMat);
    this._scene.add(this.bigBoxMesh);
    this.bigBoxMesh.castShadow = true;
    
    this.bigBoxBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(5, 5, 5)),
      position: new CANNON.Vec3(0, 100, 50),
    })
    this.physicalWorld.addBody(this.bigBoxBody);
    this.bigBoxBody.angularVelocity.set(0, 10, 0);
    this.bigBoxBody.angularDamping = 0.5;


    // Ball
    const sphereGeo = new THREE.SphereGeometry(10);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
    });
    this.sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this._scene.add(this.sphereMesh); 
    this.sphereMesh.castShadow = true; 

    this.sphereBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(10),
      position: new CANNON.Vec3(30, 100, 50),
    })
    this.physicalWorld.addBody(this.sphereBody);

    
    // Boxe Lines
    for (let i = 0; i < 25; i++) {    
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, 4, 4),
        new THREE.MeshStandardMaterial({
          color: 0x00FF00,
        }));
      this._scene.add(box);
      box.position.x = (i * 100) + 50;
      box.position.y = 10;
      box.position.z = 50;
      box.castShadow = true;
    };
    for (let i = 0; i < 25; i++) {    
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, 4, 4),
        new THREE.MeshStandardMaterial({
          color: 0xFF0000,
        }));
      this._scene.add(box);
      box.position.x = (i * 100) + 50;
      box.position.y = 10;
      box.position.z = (i * 100) + 50;
      box.castShadow = true;
    };
    for (let i = 0; i < 25; i++) {    
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, 4, 4),
        new THREE.MeshStandardMaterial({
          color: 0x00FF00,
        }));
      this._scene.add(box);
      box.position.x = -(i * 100) + 50;
      box.position.y = 10;
      box.position.z = 50;
      box.castShadow = true;
    };
    for (let i = 0; i < 25; i++) {    
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, 4, 4),
        new THREE.MeshStandardMaterial({
          color: 0xFF0000,
        }));
      this._scene.add(box);
      box.position.x = -(i * 100) + 50;
      box.position.y = 10;
      box.position.z = (i * 100) + 50;
      box.castShadow = true;
    };
    for (let i = 0; i < 25; i++) {    
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, 4, 4),
        new THREE.MeshStandardMaterial({
          color: 0x0000FF,
        }));
      this._scene.add(box);
      box.position.x = 50;
      box.position.y = 10;
      box.position.z = (i * 100) + 50;
      box.castShadow = true;
    };
    for (let i = 0; i < 1; i++) {    
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(4, 4, 4),
        new THREE.MeshStandardMaterial({
          color: 0xFFFFFF,
        }));
      this._scene.add(box);
      box.position.x = 50;
      box.position.y = 10;
      box.position.z = (i * 100) + 50;
      box.castShadow = true;
    };
    

    // Spaceship Collision Shape
    const spaceshipBodyShape = new CANNON.Box(new CANNON.Vec3(45, 15, 45));
    this.spaceshipBody = new CANNON.Body({
      mass: 100,
      shape: spaceshipBodyShape,
      
    })
    this.spaceshipBody.position.set(0, 0, 0);
    this.physicalWorld.addBody(this.spaceshipBody);

    this.cannonDebugger  = new CannonDebugger(this._scene, this.physicalWorld);

    this._mixers = [];
    this._previousRAF = null;

    this._LoadAnimatedModel();
    this._RAF();
  
  }


  _LoadAnimatedModel() {
    const params = {
      camera: this._camera,
      scene: this._scene,
    }
    this._controls = new CharacterController(params);

    this._thirdPersonCamera = new ThirdPersonCamera({
      camera: this._camera,
      target: this._controls,
    });
  }


  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();
      // Physical Animations
      this.physicalWorld.step(this.timeStep);

      // Objects
      this.bigBoxMesh.position.copy(this.bigBoxBody.position);
      this.bigBoxMesh.quaternion.copy(this.bigBoxBody.quaternion);
      this.sphereMesh.position.copy(this.sphereBody.position);
      this.sphereMesh.quaternion.copy(this.sphereBody.quaternion)

      // Spaceship
      this.spaceshipBody.position.copy(this._controls._position);
      this.spaceshipBody.quaternion.copy(this._controls.Rotation)


      // Renderer
      if (collisionDebug){
        this.cannonDebugger.update();
      }
      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }

    this._thirdPersonCamera.Update(timeElapsedS);
  }
}


// RUN APP
let _WORLD = null;

window.addEventListener('DOMContentLoaded', () => {
  // Create World
  _WORLD = new World();

});


function _LerpOverFrames(frames, t) {
  const s = new THREE.Vector3(0, 0, 0);
  const e = new THREE.Vector3(100, 0, 0);
  const c = s.clone();

  for (let i = 0; i < frames; i++) {
    c.lerp(e, t);
  }
  return c;
}

function _TestLerp(t1, t2) {
  const v1 = _LerpOverFrames(100, t1);
  const v2 = _LerpOverFrames(50, t2);
}

_TestLerp(0.01, 0.01);
_TestLerp(1.0 / 100.0, 1.0 / 50.0);
_TestLerp(1.0 - Math.pow(0.3, 1.0 / 100.0), 
          1.0 - Math.pow(0.3, 1.0 / 50.0));

  

