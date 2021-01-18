import model from "./Model";

export default new (class Session extends model {
  constructor() {
    super(false, ["key", "string"]);
  }
})();
