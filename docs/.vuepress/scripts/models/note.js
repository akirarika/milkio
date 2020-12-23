import { model } from '../../../../dist';
import database from './database';

export default new class Note extends model {
    constructor() {
        super(database, ['id', 'number']);
    }

    getIdBelow5Results() {
        return this.getResults(this.query().where('id').below(5));
    }
}