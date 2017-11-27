
const PHYSICS_TICK_SIZE_S = 0.010;      // Lyme disease is gross.  Measured in seconds.

class Denizen {
  constructor(options) {
    // console.log("constructing:", this.constructor.name, options);
    this.last_time = new Date();
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

  calc_physics_ticks(new_time) {
    var delta_t = (new_time - this.last_time) / 1000.0; // convert to seconds
    var n_ticks = Math.floor(delta_t / PHYSICS_TICK_SIZE_S);
    var seconds_consumed = n_ticks * PHYSICS_TICK_SIZE_S;
    //console.log(this.last_time.getSeconds(), this.last_time.getMilliseconds(), "...", new_time.getSeconds(), new_time.getMilliseconds(),
    //    "-->", n_ticks, "ticks,   ", seconds_consumed, "time consumed");
    this.last_time = new Date(this.last_time.getTime() + seconds_consumed * 1000);
    return n_ticks;
  }

  update(t) {
    if (this.outOfBounds(this.tank.getBounds())) { // if you're out of bounds, despawn
      this.kill();
    } else {
      for (var i = 0; i < this.calc_physics_ticks(t); i++) {
        this.update_one_tick();
      }
    }
  }

  update_one_tick() {
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
      this.position.x + 5 * this.width < bounds.min_x ||
      this.position.x - 5 * this.width > bounds.max_x ||
      this.position.y + 5 * this.height < bounds.min_y ||
      this.position.y - 5 * this.height > bounds.max_y
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

  update_one_tick() {
    var delta = this.swimVelocity.scale(PHYSICS_TICK_SIZE_S);
    this.position.add_mut(delta);
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

  update_one_tick() {
    var delta = this.swimVelocity.scale(PHYSICS_TICK_SIZE_S * (1 + this.surgeSecondsLeft * this.surgMult));
    this.position.add_mut(delta);
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

  update_one_tick() {
    super.update_one_tick();
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
    var x_vel = randRangeInt(-300, 300);
    var y_vel = 400 - Math.abs(x_vel);
    var s = new Seed({
      tank: this.tank,
      position: this.position,
      velocity: new Vector(x_vel, y_vel),
      type: this.tank.getRandomSpecies(),
    });
  }
}

class Seed extends Denizen {
  constructor(options) {
    super(options);
    this.water_friction = 0.3;      // "0.3" means "lose 30% per second"
    this.imageUri = '/images/seed.png';
    this.type = options.type;
    this.height = options.height || 30;
    this.width = options.width || 30;
    this.ttl = options.ttl || randRangeInt(3, 6);
  }

  update_one_tick() {
    this.velocity = this.velocity.scale( 1 - this.water_friction * PHYSICS_TICK_SIZE_S );
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

  update_one_tick() {
    this.linger -= PHYSICS_TICK_SIZE_S;
    if (this.linger < 0) { this.kill(this.leave); }
  }
}
