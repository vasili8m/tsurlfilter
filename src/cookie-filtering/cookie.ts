/**
 * Cookie object
 */
export class Cookie {
    /**
     * Cookie name
     */
    name: string;

    /**
     * Cookie value
     */
    value: string;

    /**
     * Constructor
     *
     * @param name
     * @param value
     */
    constructor(name: string, value: string) {
        this.name = name;
        this.value = value;
    }
}
