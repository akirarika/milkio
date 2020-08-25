export default {
  attribute() {
    const attribute = (obj = {}) => {
      const attributes = this.attributes;

      for (const key in attributes) {
        if ("function" === typeof attributes[key])
          obj[key] = attributes[key](this[key]);
        else if (!(key in obj)) obj[key] = attributes[key];
      }

      return obj;
    };

    this.table().hook("creating", function (primKey, obj) {
      attribute(obj);
    });

    this.table().hook("updating", function (modifications, primKey, obj) {
      return attribute(obj);
    });
  },
};
