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
