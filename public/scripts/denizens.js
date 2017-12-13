
const PHYSICS_TICK_SIZE_S = 0.010;      // Lyme disease is gross.  Measured in seconds.

class Denizen {
  constructor(options) {
    // console.log("constructing:", this.constructor.name, options);
    this.lastTime = new Date();
    this.height = options.height || 60;
    this.width = options.width || 60;
    this.position = options.position.clone();
    if (options.velocity) {
      this.velocity = options.velocity.clone();
    }
    this.tank = options.tank;
    this.id = this.tank.registerDenizen(this);
    this.onClick = this.onClick.bind(this);
  }

  calcPhysicsTicks(newTime) {
    var deltaTime = (newTime - this.lastTime) / 1000.0; // convert to seconds
    var numTicks = Math.floor(deltaTime / PHYSICS_TICK_SIZE_S);
    var secondsConsumed = numTicks * PHYSICS_TICK_SIZE_S;
    //console.log(this.lastTime.getSeconds(), this.lastTime.getMilliseconds(), "...", newTime.getSeconds(), newTime.getMilliseconds(),
    //    "-->", numTicks, "ticks,   ", secondsConsumed, "time consumed");
    this.lastTime = new Date(this.lastTime.getTime() + secondsConsumed * 1000);
    return numTicks;
  }

  update(t) {
    // if you're out of bounds, despawn
    if (this.outOfBounds(this.tank.getBounds())) {
      this.kill();
    } else {
      for (var i = 0; i < this.calcPhysicsTicks(t); i++) {
        this.updateOneTick();
      }
    }
  }

  updateOneTick() {
    throw "not implemented";
  }

  renderRules() {
    return {
      imageUri: this.imageUri,
      css: {
        width: this.width,
        height: this.height,
      },
      x: this.position.x - Math.floor(this.width/2),
      y: this.position.y - Math.floor(this.height/2),
    };
  }

  onClick(event) {
    throw "not implemented";
  }

  kill(duration) {
    // duration can be undefined, no problem
    // console.log("like tears, in rain.  time to die.", this);
    this.tank.removeDenizen(this.id, duration);
  }

  outOfBounds(bounds) {
    // TODO: it'd be cool if Seeds could go above the top fo the tank, then fall back down
    return (
      this.position.x + 5 * this.width < bounds.minX ||
      this.position.x - 5 * this.width > bounds.maxX ||
      this.position.y + 5 * this.height < bounds.minY ||
      this.position.y - 5 * this.height > bounds.maxY
    );
  }
}


class Fish extends Denizen {
  constructor(options) {
    super(options);
    this.imageUri = '/images/fish01.png';
    this.maxSwimSpeed = 100;
    this.makeNewVelocity();
    this.isTasty = true;
  }

  generateSwimVelocity(max, min) {
    if (min && min > max) {
      min = 0;
    }
    var newSpeed = new Vector(randRangeInt(-max, max), randRangeInt(-max / 2, max / 2));
    while (min && newSpeed.magnitude() < min) {
      newSpeed = new Vector(randRangeInt(-max, max), randRangeInt(-max / 2, max / 2));
    }
    return newSpeed;
  }

  updateOneTick() {
    var delta = this.swimVelocity.scale(PHYSICS_TICK_SIZE_S);
    this.position.addMut(delta);
    this.timeUntilSpeedChange -= PHYSICS_TICK_SIZE_S;
    if (this.timeUntilSpeedChange < 0) {
      this.makeNewVelocity();
    }
  }

  makeNewVelocity(minMag) {
    this.swimVelocity = this.generateSwimVelocity(this.maxSwimSpeed, minMag || 0);
    this.timeUntilSpeedChange = randRangeInt(5);
  }

}

class SwitchFish extends Fish {
  onClick(event) {
    this.makeNewVelocity(50);
  }
}

class GoFish extends Fish {
  constructor(options) {
    super(options);
    this.surgeSecondsLeft = 0;
    this.maxSurge = 1.0;
    this.surgMult = 3.0;
  }

  updateOneTick() {
    var delta = this.swimVelocity.scale(PHYSICS_TICK_SIZE_S * (1 + this.surgeSecondsLeft * this.surgMult));
    this.position.addMut(delta);
    this.timeUntilSpeedChange -= PHYSICS_TICK_SIZE_S;
    if (this.timeUntilSpeedChange < 0) {
      this.makeNewVelocity();
    }
    this.surgeSecondsLeft = Math.max(0, this.surgeSecondsLeft - PHYSICS_TICK_SIZE_S);
  }


  onClick(event) {
    this.surgeSecondsLeft = this.maxSurge;
  }
}

class BiteFish extends GoFish {
  constructor(options) {
    super(options);
    this.imageUri = '/images/fish02.gif';
    this.eaten = 2;
    this.isTasty = false;
  }

  updateOneTick() {
    super.updateOneTick();
    var proximates = this.tank.getProximateDenizens(this.position, this.height * 1.5);
    var nearbyFood = proximates.filter(individual => individual.isTasty);
    for (let individual of nearbyFood) {
      this.eaten++;
      individual.kill();
      // TODO: animation
      new Event({tank: this.tank, position: this.position, imageUri: this.imageUri});
    }
  }
}


class Starter extends Denizen {
  constructor(options) {
    super(options);
    this.imageUri = '/images/volcano.jpg';
    this.position.y += this.height;
  }

  update(t) {
    // no physics for Starter
  }

  onClick(event) {
    var xVel = randRangeInt(-300, 300);
    var yVel = 400 - Math.abs(xVel);
    var s = new Seed({
      tank: this.tank,
      position: this.position,
      velocity: new Vector(xVel, yVel),
      type: this.tank.getRandomSpecies(),
    });
  }
}

class Seed extends Denizen {
  constructor(options) {
    super(options);
    this.waterFriction = 0.3;      // "0.3" means "lose 30% per second"
    this.imageUri = '/images/seed.png';
    this.type = options.type;
    this.height = options.height || 30;
    this.width = options.width || 30;
    this.ttl = options.ttl || randRangeInt(3, 6);
  }

  updateOneTick() {
    this.velocity = this.velocity.scale( 1 - this.waterFriction * PHYSICS_TICK_SIZE_S );
    this.velocity.y -= 50 * PHYSICS_TICK_SIZE_S;

    var delta = this.velocity.scale(PHYSICS_TICK_SIZE_S);
    this.position = this.position.add(delta);

    this.ttl -= PHYSICS_TICK_SIZE_S;
    if (this.ttl < 0) {
      this.spawn();
      this.kill();
    }
  }

  spawn() {
    var Type = this.type;
    var individual = new Type({
      tank: this.tank,
      position: this.position,
    });
  }

  onClick(event) {
    this.spawn();
    this.kill();
  }

}

class Effect extends Denizen {
  constructor(options) {
    super(options);
    this.imageUri = options.imageUri;
    this.linger = options.linger || 0;
    this.leave = options.leave || undefined;
  }

  updateOneTick() {
    this.linger -= PHYSICS_TICK_SIZE_S;
    if (this.linger < 0) { this.kill(this.leave); }
  }
}
