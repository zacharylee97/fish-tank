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
