import { getSite } from './site';
export async function getCategories() { return (await getSite()).categories; }
