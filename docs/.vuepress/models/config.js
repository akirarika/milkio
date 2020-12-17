import { model } from '../../../dist';
import database from './database';

export default new class Config extends model {
    constructor() {
        super(database, ['key', 'string']);
    }

    async seeding(data) {
        data.hello = 'world';
        data.world = 'hello';
    }

    async test() {
        return await this.getResults(this.query().where('key').equals('test'));
    }
}