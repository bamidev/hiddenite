import { Song } from '../song/provider';

export interface Queue {
  id: string;
  name: string;
  songs: Song[];
}
