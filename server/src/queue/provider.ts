import { Song } from '../song/provider';

export interface Queue {
  id: string;
  songs: Song[];
}
