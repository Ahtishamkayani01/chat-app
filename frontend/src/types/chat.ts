export type RoomType = "global" | "direct" | "group";

export interface Message {
  _id: string;
  room: string; // room id this message belongs to
  sender: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  _id: string;
  type: RoomType;
  name?: string; // groups only
  members: string[]; // usernames (empty for global = everyone)
  admins: string[];
  directKey?: string;
  createdBy?: string;
  lastMessage?: { text: string; sender: string; at: string };
  createdAt: string;
  updatedAt: string;
}
