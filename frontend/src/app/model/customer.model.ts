export interface Customer{
    id?:string;
    _id?:string;
    name:string;
    googleId?:string;
    age?:number;
    gender?:string;
    email:string;
    dateofbirth?:string;
    profilepicture?:string;
    preferredTheme?: 'light' | 'dark';
    preferredLanguage?: 'en' | 'hi' | 'mr';
}